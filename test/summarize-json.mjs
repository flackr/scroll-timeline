#!/usr/bin/env node

import { readFileSync } from 'fs';

let data = JSON.parse(readFileSync(process.argv[2]));
const results = data.results.sort((r1, r2) => {
  return r1.test.localeCompare(r2.test);
});
let passes = 0, fails = 0;
for (let result of results) {
  for (let subtest of result.subtests) {
    console.log(`${subtest.status}\t${result.test}\t${subtest.name}`);
    if (subtest.status == "PASS") {
      passes++;
    } else {
      fails++;
    }
  }
}
