import { BuilderAnalyzer }
from "../Builder/Intelligence/BuilderAnalyzer";


test(
"BuilderAnalyzer should analyze project",
()=>{

const analyzer =
new BuilderAnalyzer();


const result =
analyzer.analyze("HooshyarOS");


expect(result.project)
.toBe("HooshyarOS");


expect(result.status)
.toBe("READY");


expect(result.risk)
.toBe("LOW");


});

