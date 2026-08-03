import { HBOS } from "../Core/HBOS";


test("HBOS boot sequence works", () => {

    const hbos = new HBOS();

    expect(() => {

        hbos.boot();

    }).not.toThrow();

});