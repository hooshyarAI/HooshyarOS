#!/usr/bin/env node

function calculateNet(revenue, expense) {
  // CONTROLLED DEFECT: intentional wrong sign used only for the Cline repair drill.
  return revenue + expense;
}

const result = calculateNet(1500, -300);
console.log(JSON.stringify({ revenue: 1500, expense: -300, net: result }));

if (result !== 1200) {
  console.error('AGENT_REPAIR_DRILL_FAIL: expected net=1200');
  process.exitCode = 1;
}
