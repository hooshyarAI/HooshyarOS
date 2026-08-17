import { aggregateRisk } from "./RiskAggregationEngine";
describe("Risk aggregation",()=>{ it("classifies concentrated critical risk",()=>expect(aggregateRisk([{name:"security",probability:100,impact:100}])).toEqual({score:100,level:"CRITICAL"})); it("classifies low risk",()=>expect(aggregateRisk([{name:"ui",probability:10,impact:10}]).level).toBe("LOW")); });
