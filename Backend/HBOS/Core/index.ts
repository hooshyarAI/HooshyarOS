import { HBOS } from "./HBOS";

const system = new HBOS();

const ready = system.boot();

console.log({
    status: ready ? "READY" : "BLOCKED",
    health: system.health()
});
