/**
 * Real Windows Setup Wizard smoke test for the Inno Setup customer installer.
 *
 * The previous IExpress acceptance used `Setup.exe /Q /T:<temp> /C` plus a
 * direct `install.ps1` invocation, which never proved the normal user
 * experience. This harness proves the real chain:
 *
 *   A. launch the generated Setup EXE as a normal desktop installer;
 *   B. observe the visible HooshyarOS Setup Wizard window;
 *   C. install to an identity-isolated directory (same payload, distinct AppId
 *      and shortcut names, so a pre-existing customer install is never touched);
 *   D. verify the installed files, Start Menu and Desktop shortcuts;
 *   E. verify the Windows "Apps & features" uninstall registration;
 *   F. launch the product through its real installed shortcut launcher;
 *   G. verify the actual /health endpoint becomes healthy;
 *   H. verify the user-facing HooshyarOS interface is served;
 *   I. run the generated uninstaller and verify removal.
 *
 * Usage: node scripts/windows-setup-wizard-smoke.cjs
 * Env:
 *   HOOSHYAR_SMOKE_PORT          canonical runtime port (default 4173)
 *   HOOSHYAR_SMOKE_RESTORE_DIR   installed product dir to relaunch afterwards
 */
const { spawn, spawnSync, execFileSync } = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const root = process.cwd();
const port = Number(process.env.HOOSHYAR_SMOKE_PORT ?? "4173");
const windowsRoot = path.join(root, "dist", "productization", "windows");
const payload = path.join(windowsRoot, "payload");
const canonicalIss = path.join(root, "installer", "HooshyarOS.iss");
const workDir = path.join(root, ".hooshyar", "setup-wizard-smoke");
const smokeOut = path.join(workDir, "installer-out");
const smokeIss = path.join(workDir, "HooshyarOS-Smoke.iss");
const smokeInstallDir = path.join(workDir, "installed");
const evidencePath = path.join(root, ".hooshyar", "setup-wizard-smoke.json");
const isccCandidates = [
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Inno Setup 7", "ISCC.exe"),
    path.join(process.env.LOCALAPPDATA || "", "Programs", "Inno Setup 6", "ISCC.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Inno Setup 7", "ISCC.exe"),
    path.join(process.env["ProgramFiles(x86)"] || "", "Inno Setup 6", "ISCC.exe"),
    path.join(process.env.ProgramFiles || "", "Inno Setup 7", "ISCC.exe"),
    path.join(process.env.ProgramFiles || "", "Inno Setup 6", "ISCC.exe"),
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];

function fail(message) {
    throw new Error(message);
}

function record(stage, details) {
    results.push({ stage, ok: true, details });
    console.log(JSON.stringify({ type: "SETUP_WIZARD_SMOKE", stage, ok: true, details }));
}

function findIscc() {
    const onPath = spawnSync("where", ["ISCC.exe"], { cwd: root, encoding: "utf8" });
    if (onPath.status === 0) {
        const first = onPath.stdout.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)[0];
        if (first && fs.existsSync(first)) return first;
    }
    const found = isccCandidates.find((candidate) => candidate && fs.existsSync(candidate));
    if (!found) fail("Inno Setup compiler (ISCC.exe) was not found");
    return found;
}

function canonicalSetupExe() {
    const canonical = fs.readFileSync(canonicalIss, "utf8");
    const version = /#define\s+AppVersion\s+"([^"]+)"/.exec(canonical)?.[1] ?? "1.0.0";
    const base = /^OutputBaseFilename=(.+)$/m.exec(canonical)?.[1].trim().replace("{#AppVersion}", version)
        ?? `HooshyarOS-Setup-${version}`;
    return path.join(windowsRoot, "installer", `${base}.exe`);
}

function killPort(targetPort) {
    try {
        const output = execFileSync(
            "powershell.exe",
            ["-NoProfile", "-Command",
                `Get-NetTCPConnection -LocalPort ${targetPort} -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique`],
            { encoding: "utf8" },
        );
        for (const pid of output.split(/\s+/).filter(Boolean)) {
            try { execFileSync("taskkill", ["/PID", pid, "/T", "/F"], { stdio: "ignore" }); } catch { /* already gone */ }
        }
    } catch { /* nothing listening */ }
}

function portOccupied() {
    try {
        const output = execFileSync(
            "powershell.exe",
            ["-NoProfile", "-Command",
                `(Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue | Measure-Object).Count`],
            { encoding: "utf8" },
        );
        return Number(output.trim()) > 0;
    } catch {
        return false;
    }
}

async function waitFor(condition, timeoutMs = 30000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (condition()) return true;
        await sleep(500);
    }
    return condition();
}

async function waitHealth(timeoutMs = 90000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        try {
            const response = await fetch(`http://127.0.0.1:${port}/health`);
            if (response.ok && (await response.json()).status === "ok") return true;
        } catch { /* not up yet */ }
        await sleep(500);
    }
    return false;
}

/** A. Launch the produced Setup EXE and B. observe the visible wizard window. */
async function verifyWizardAppears(setupExe) {
    if (!fs.existsSync(setupExe)) fail(`Setup EXE missing: ${setupExe}`);
    // Inno Setup extracts itself and re-executes as `<name>.tmp`, so the PID of
    // the launcher exits immediately. Detect the real wizard window by its
    // stable Inno title ("Setup - <AppName>"), which cannot match an unrelated
    // window that merely mentions HooshyarOS.
    spawn(setupExe, [], { cwd: root, stdio: "ignore", windowsHide: false });
    const detect = "Get-Process | Where-Object { $_.MainWindowTitle -like 'Setup - HooshyarOS*' } | Select-Object -First 1 | ForEach-Object { \"$($_.Id)|$($_.MainWindowTitle)\" }";
    let wizardPid = "";
    let title = "";
    try {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
            let raw = "";
            try {
                raw = execFileSync("powershell.exe", ["-NoProfile", "-Command", detect], { encoding: "utf8" }).trim();
            } catch { raw = ""; }
            if (raw) {
                [wizardPid, title] = raw.split("|");
                break;
            }
            await sleep(500);
        }
        if (!wizardPid || !title) fail("the Setup EXE did not present a visible wizard window");
        record("wizard-visible", { title, pid: wizardPid });
    } finally {
        if (wizardPid) {
            try { execFileSync("taskkill", ["/PID", wizardPid, "/T", "/F"], { stdio: "ignore" }); } catch { /* already closed */ }
        }
    }
}

/**
 * Remove any isolated install left by a previous smoke run through its own
 * generated uninstaller, so its uninstall registration and shortcuts never leak
 * into the next run.
 */
function cleanupPreviousInstall() {
    const uninstaller = path.join(smokeInstallDir, "unins000.exe");
    if (fs.existsSync(uninstaller)) {
        spawnSync(uninstaller, ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], { cwd: root, stdio: "inherit" });
    }
    const priorKey = path.join(workDir, "app-id.txt");
    if (fs.existsSync(priorKey)) {
        const guid = fs.readFileSync(priorKey, "utf8").trim().replace(/[{}]/g, "");
        spawnSync("reg", ["delete", `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{${guid}}_is1`, "/f"], { cwd: root, stdio: "ignore" });
    }
    fs.rmSync(workDir, { recursive: true, force: true });
}

/** C. Build an identity-isolated installer from the identical canonical definition and payload. */
function buildIsolatedInstaller() {
    if (!fs.existsSync(path.join(payload, "launch-hooshyar.vbs"))) fail("payload missing; run release_product_builder.py first");
    const iscc = findIscc();
    cleanupPreviousInstall();
    fs.mkdirSync(smokeOut, { recursive: true });

    // Inno's `AppId={{GUID}` escapes a literal leading brace, so the logical
    // AppId (and its uninstall registry key) is `{GUID}` with single braces.
    const appId = `{${crypto.randomUUID().replace(/-/g, "").toUpperCase()}}`;
    const appIdDirective = `{${appId}`;
    const canonical = fs.readFileSync(canonicalIss, "utf8");
    const isolated = canonical
        .replace(/AppId=\{\{[0-9A-Fa-f-]+\}/, `AppId=${appIdDirective}`)
        .replace(/DefaultDirName=\{localappdata\}\\Programs\\HooshyarOS\r?\n/, `DefaultDirName={localappdata}\\Programs\\HooshyarOS-Smoke\n`)
        .replace(/DefaultGroupName=HooshyarOS\r?\n/, "DefaultGroupName=HooshyarOS-Smoke\n")
        .replace(/OutputDir=.*\r?\n/, `OutputDir=${smokeOut}\n`)
        .replace(/OutputBaseFilename=.*\r?\n/, "OutputBaseFilename=HooshyarOS-Setup-Smoke\n")
        .replace(/SetupIconFile=.*\r?\n/, `SetupIconFile=${path.join(payload, "hooshyaros.ico")}\n`)
        .replace(/Source: ".*payload\\\*"/, `Source: "${path.join(payload, "*")}"`)
        .replace(/Name: "\{autoprograms\}\\HooshyarOS\\HooshyarOS"/, 'Name: "{autoprograms}\\HooshyarOS-Smoke\\HooshyarOS-Smoke"')
        .replace(/Name: "\{autodesktop\}\\HooshyarOS"/, 'Name: "{autodesktop}\\HooshyarOS-Smoke"');
    if (!isolated.includes("HooshyarOS-Smoke") || !isolated.includes(appId) || !isolated.includes("skipifsilent")) {
        fail("failed to generate the isolated smoke installer definition");
    }
    fs.writeFileSync(smokeIss, isolated, "utf8");
    fs.writeFileSync(path.join(workDir, "app-id.txt"), appId, "utf8");

    const compile = spawnSync(iscc, [smokeIss], { cwd: root, stdio: "inherit" });
    if (compile.status !== 0) fail(`ISCC exited with ${compile.status}`);
    const setup = path.join(smokeOut, "HooshyarOS-Setup-Smoke.exe");
    if (!fs.existsSync(setup)) fail(`isolated smoke installer was not produced: ${setup}`);
    record("isolated-installer-built", { setup, appId });
    return { setup, appId };
}

function uninstallKey(appId) {
    const guid = appId.replace(/[{}]/g, "");
    return `HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\{${guid}}_is1`;
}

/** C/E. Install silently and verify files, shortcuts and the uninstall registration. */
function installIsolated(setup, appId) {
    fs.rmSync(smokeInstallDir, { recursive: true, force: true });
    const result = spawnSync(
        setup,
        ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART", `/DIR=${smokeInstallDir}`, "/MERGETASKS=desktopicon,startmenuicon", `/LOG=${path.join(workDir, "install.log")}`],
        { cwd: root, stdio: "inherit" },
    );
    if (result.status !== 0) fail(`isolated install failed with exit code ${result.status}`);

    const requiredFiles = [
        "node-runtime/node.exe",
        "node_modules/tsx/dist/cli.mjs",
        "Backend/HBOS/Autonomous/Runtime/start-commercial-runtime.ts",
        "web/index.html",
        "launch-hooshyar.vbs",
        "launch-hooshyar.ps1",
        "launch-hooshyar.cmd",
        "hooshyaros.ico",
        "unins000.exe",
    ];
    const missing = requiredFiles.filter((relative) => !fs.existsSync(path.join(smokeInstallDir, ...relative.split("/"))));
    if (missing.length) fail(`installed payload incomplete: ${missing.join(", ")}`);
    record("installed-files", { installDir: smokeInstallDir, files: requiredFiles.length });

    const startMenu = path.join(
        process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"),
        "Microsoft", "Windows", "Start Menu", "Programs", "HooshyarOS-Smoke", "HooshyarOS-Smoke.lnk",
    );
    const desktop = path.join(os.homedir(), "Desktop", "HooshyarOS-Smoke.lnk");
    const shortcuts = { startMenu, desktop };
    for (const [name, shortcut] of Object.entries(shortcuts)) {
        if (!fs.existsSync(shortcut)) fail(`${name} shortcut was not created: ${shortcut}`);
    }
    record("shortcuts", shortcuts);

    const key = uninstallKey(appId);
    const query = spawnSync("reg", ["query", key, "/v", "DisplayName"], { cwd: root, encoding: "utf8" });
    if (query.status !== 0 || !query.stdout.includes("HooshyarOS")) {
        fail(`the installer does not register the product for uninstall: ${key}`);
    }
    record("uninstall-registration", { key });
    return { startMenu, desktop, key };
}

/** F/G/H. Launch through the real installed shortcut launcher, verify health and the UI. */
async function launchAndVerify() {
    const target = path.join(smokeInstallDir, "launch-hooshyar.vbs");
    if (!fs.existsSync(target)) fail(`installed shortcut launcher missing: ${target}`);
    const child = spawn("wscript.exe", [target], { cwd: smokeInstallDir, stdio: "ignore", windowsHide: true });
    const exited = new Promise((resolve) => {
        child.once("error", (error) => resolve({ error }));
        child.once("exit", (code) => resolve({ code }));
    });
    if (!(await waitHealth())) fail("the installed runtime did not become healthy through its real shortcut launcher");
    record("launcher-health", { port });

    const rootPage = await fetch(`http://127.0.0.1:${port}/`);
    const html = await rootPage.text();
    if (!rootPage.ok || !html.includes("هوشیارOS") || !html.includes("main-workspace")) {
        fail("the user-facing HooshyarOS interface was not served");
    }
    record("user-interface", { bytes: html.length });

    const exit = await Promise.race([exited, sleep(5000).then(() => ({ timeout: true }))]);
    if (exit.error) throw exit.error;
    if (exit.timeout) fail("the shortcut launcher did not exit after reporting health success");
    if (exit.code !== 0) fail(`the shortcut launcher exited with ${exit.code}`);
}

/** I. Run the generated uninstaller and verify removal. */
async function uninstallIsolated(key, shortcuts) {
    killPort(port);
    const uninstaller = path.join(smokeInstallDir, "unins000.exe");
    if (!fs.existsSync(uninstaller)) fail(`generated uninstaller missing: ${uninstaller}`);
    const result = spawnSync(uninstaller, ["/VERYSILENT", "/SUPPRESSMSGBOXES", "/NORESTART"], { cwd: root, stdio: "inherit" });
    if (result.status !== 0) fail(`uninstall failed with exit code ${result.status}`);
    // Inno's uninstaller re-executes from a temp copy and can return before the
    // removed files are gone, so wait for the observable end state.
    const registrationGone = () => spawnSync("reg", ["query", key, "/v", "DisplayName"], { cwd: root, encoding: "utf8" }).status !== 0;
    await waitFor(() => !fs.existsSync(smokeInstallDir)
        && Object.values(shortcuts).every((shortcut) => !fs.existsSync(shortcut))
        && registrationGone());
    if (fs.existsSync(smokeInstallDir)) fail(`install directory was not removed: ${smokeInstallDir}`);
    for (const [name, shortcut] of Object.entries(shortcuts)) {
        if (fs.existsSync(shortcut)) fail(`${name} shortcut was not removed: ${shortcut}`);
    }
    if (!registrationGone()) fail(`uninstall registration was not removed: ${key}`);
    record("uninstall", { removed: smokeInstallDir, key });
}

async function main() {
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    try { fs.rmSync(evidencePath, { force: true }); } catch { /* ignore */ }

    const canonicalSetup = canonicalSetupExe();
    const stats = fs.statSync(canonicalSetup);
    if (stats.size < 1024 * 1024) fail(`canonical Setup EXE is suspiciously small: ${stats.size} bytes`);
    record("canonical-setup-exe", { setup: canonicalSetup, bytes: stats.size });

    await verifyWizardAppears(canonicalSetup);

    const { setup, appId } = buildIsolatedInstaller();
    const shortcuts = installIsolated(setup, appId);
    killPort(port);
    await sleep(1000);
    await launchAndVerify();
    killPort(port);
    await sleep(1500);
    await uninstallIsolated(shortcuts.key, { startMenu: shortcuts.startMenu, desktop: shortcuts.desktop });

    fs.writeFileSync(evidencePath, JSON.stringify({
        type: "SETUP_WIZARD_SMOKE",
        status: "PASS",
        createdAt: new Date().toISOString(),
        canonicalSetup,
        canonicalSetupBytes: stats.size,
        results,
    }, null, 2), "utf8");
    console.log(JSON.stringify({ type: "SETUP_WIZARD_SMOKE", status: "PASS", stages: results.map((r) => r.stage) }, null, 2));
}

// Captured before the smoke test stops any listener so a pre-existing customer
// runtime can be restored afterwards.
const previousRuntimePresent = portOccupied();
main()
    .catch((error) => {
        try { fs.rmSync(evidencePath, { force: true }); } catch { /* ignore */ }
        console.error(JSON.stringify({ type: "SETUP_WIZARD_SMOKE", status: "BLOCKED", error: error.message }, null, 2));
        process.exitCode = 1;
    })
    .finally(async () => {
        killPort(port);
        const restoreDir = process.env.HOOSHYAR_SMOKE_RESTORE_DIR;
        if (previousRuntimePresent && restoreDir) {
            const launcher = path.join(restoreDir, "launch-hooshyar.vbs");
            if (fs.existsSync(launcher)) {
                try { spawn("wscript.exe", [launcher], { cwd: restoreDir, stdio: "ignore", windowsHide: true }); } catch { /* restore is best effort */ }
            }
        }
    });
