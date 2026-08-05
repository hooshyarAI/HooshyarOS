import { HBOS } from "../Core/HBOS";


describe(
"HBOS Boot Integration",
()=>{


test(
"should boot when dependencies are available",
()=>{


const hbos =
new HBOS();



const result =
hbos.boot();



expect(result)
.toBe(true);



});


});