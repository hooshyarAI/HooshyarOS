"use strict";
const assert = require("node:assert/strict");
function free(m){const c=m&&m.cost;return !!c&&typeof c==="object"&&Object.keys(c).length>0&&Object.values(c).every(v=>typeof v==="number"&&Number.isFinite(v)&&v===0);}
function provider(id){return id.includes("/")?id.split("/",1)[0]:id;}
assert.equal(free({cost:{input:0,output:0}}),true);
assert.equal(free({cost:{input:0,output:0.01}}),false);
assert.equal(free({cost:{}}),false);
assert.equal(free({cost:{input:"0",output:"0"}}),false);
assert.equal(provider("provider-a/model-x"),"provider-a");
console.log("TEAM_V2_MODEL_ROUTING_TEST=PASS");
