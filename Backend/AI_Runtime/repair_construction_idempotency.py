from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
TARGET = ROOT / "Backend/HBOS/Autonomous/Runtime/LocalConstructionToolset.ts"

OLD_ARTIFACT = 'const artifact={type:"AUTONOMOUS_AGENT_GENERATION_RESULT",'
NEW_ARTIFACT = 'const artifact:Record<string,any>={type:"AUTONOMOUS_AGENT_GENERATION_RESULT",'

OLD_GENERATOR = 'if(!changed)return{ok:false,issue:"AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE",artifact};if(!touchesDeclaredArtifact||unexpectedPaths.length>0)return{ok:false,issue:"AUTONOMOUS_ARTIFACT_BOUNDARY_VIOLATION",artifact};return{ok:true,artifact};'
NEW_GENERATOR = 'const idempotent=Boolean(!changed&&requiredPaths.every(path=>existsSync(path))&&unexpectedPaths.length===0);artifact.idempotent=idempotent;if(!changed&&!idempotent)return{ok:false,issue:"AUTONOMOUS_AGENT_NO_REPOSITORY_CHANGE",artifact};if(!touchesDeclaredArtifact&&!idempotent||unexpectedPaths.length>0)return{ok:false,issue:"AUTONOMOUS_ARTIFACT_BOUNDARY_VIOLATION",artifact};return{ok:true,artifact};'

OLD_REPO = 'const repositoryEvidenceValid=currentStatus.ok&&unexpectedCurrentPaths.length===0&&unexpectedGeneratorPaths.length===0&&generatorChangedPaths.length>0;'
NEW_REPO = 'const generatorIdempotent=Boolean((generatorArtifact as any)?.idempotent);const repositoryEvidenceValid=currentStatus.ok&&unexpectedCurrentPaths.length===0&&unexpectedGeneratorPaths.length===0&&(generatorChangedPaths.length>0||generatorIdempotent);'

content = TARGET.read_text(encoding="utf-8")
changed = False

if OLD_ARTIFACT in content:
    content = content.replace(OLD_ARTIFACT, NEW_ARTIFACT, 1)
    changed = True
if OLD_GENERATOR in content:
    content = content.replace(OLD_GENERATOR, NEW_GENERATOR, 1)
    changed = True
if OLD_REPO in content:
    content = content.replace(OLD_REPO, NEW_REPO, 1)
    changed = True

if not changed:
    print("IDEMPOTENCY_ALREADY_PRESENT")
else:
    TARGET.write_text(content, encoding="utf-8")
    print(f"IDEMPOTENCY_PATCHED {TARGET.relative_to(ROOT)}")
