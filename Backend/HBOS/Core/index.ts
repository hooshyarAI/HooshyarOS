import { HBOS } from "./HBOS";

const system = new HBOS();

system.initialize();

console.log(system.status());