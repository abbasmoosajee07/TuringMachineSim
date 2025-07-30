import { TuringConfig } from './TuringMachine.js';
import { MachineLogic } from './TuringMachine.js';

class TuringRunner {
    constructor(transitionsStr, initialTape = "", maxSteps = 1_000_000) {
        this.MAX_STEPS = maxSteps;
        this.BASE_STEP = 1;
        this.DELAY = 300;
        this.step_count = 0;
        this.running = false;

        this.transitionsStr = transitionsStr;
        this.initialTape = initialTape || "||||";

        this.load();
    }

    parseTransitionRules(transitionRulesStr) {
        const transitionsList = [];
        const rawRuleList = transitionRulesStr.split("\n");
        for (const rawLine of rawRuleList) {
            const line = rawLine.trim();
            if (!line || line.startsWith("//")) continue;
            const cleanedLine = line.split("//")[0].trim();
            const values = cleanedLine.split(/\s+/).filter(val => val.trim());

            if (values.length !== 5) {
                throw new Error(`Invalid transition: "${cleanedLine}". Expected 5 elements.`);
            }

            const [currentState, currentSymbol, newState, newSymbol, direction] = values;
            if (direction !== "L" && direction !== "R") {
                throw new Error(`Invalid direction '${direction}' in "${cleanedLine}".`);
            }
            for (const [symbol, label] of [[currentSymbol, "current"], [newSymbol, "new"]]) {
                if (symbol.length !== 1) {
                    throw new Error(`Invalid ${label}_symbol '${symbol}'. Must be a single char.`);
                }
            }

            transitionsList.push([currentState, currentSymbol, newState, newSymbol, direction]);
        }

        if (transitionsList.length === 0) {
            throw new Error("No valid transition rules found.");
        }

        return transitionsList;
    }

    load() {
        const transitions = this.parseTransitionRules(this.transitionsStr);
        this.cpu = new MachineLogic(transitions);
        this.cpu._setTape(this.initialTape);

        this.init_time = TuringConfig.getTimestamp();
        this.step_count = 0;
        this.running = false;

        this.history = [{
            tape: { ...this.cpu.tape },
            head: this.cpu.head_position,
            state: this.cpu.current_state
        }];
    }

    step(n = 1) {
        const max_allowed = this.MAX_STEPS;

        for (let i = 0; i < n; i++) {
            if (this.step_count >= max_allowed) {
                console.log(`Max steps (${max_allowed}) reached`);
                return false;
            }

            if (this.cpu.current_state === this.cpu.halt_state) {
                console.log(`Machine HALTED | Total Steps: ${this.step_count}`);
                return false;
            }

            try {
                this.cpu._stepLogic();
                this.step_count++;
                this.history.push({
                    tape: { ...this.cpu.tape },
                    head: this.cpu.head_position,
                    state: this.cpu.current_state
                });
            } catch (error) {
                console.error(`Machine STUCK after ${this.step_count} steps`);
                throw error;
            }
        }
        return true;
    }

    run() {
        while (this.step()) {}
        this.printSummary();
    }

    printSummary() {
        const final_tape = this.cpu._printTapeState();
        const run_time = (TuringConfig.getTimestamp() - this.init_time).toFixed(3);
        console.log("=== RUN COMPLETE ===");
        console.log(`Final Tape: ${final_tape}`);
        console.log(`Steps: ${this.step_count}`);
        console.log(`Rules: ${this.cpu.transitions_list.length}`);
        console.log(`Time Elapsed: ${run_time}s`);
        console.log(`Memory Used: ${TuringConfig.getCurrentMemoryMB()} MB`);
    }
}

// Example usage:
const rules = `
INIT  | toB   _ R   // Erase | from a, move to copy b
INIT  * SKIP  _ R   // All of a consumed, erase '*' and move to HALT

toB   | toB   | R
toB   * eachB * R   // Move to start copying b

nextA _ INIT  _ R   // After one copy of b, move back to INIT
nextA | nextA | L
nextA * nextA * L

SKIP  | SKIP  _ R   // Erase b
SKIP  _ HALT  _ R

eachB _ nextA _ L   // No more b to copy
eachB | sep   _ R   // Copy this '|', erase original

sep   _ add   _ R
sep   | sep   | R

add   _ sepL  | L   // Add copy of b to end
add   | add   | R

sepL  _ nextB _ L
sepL  | sepL  | L

nextB _ eachB | R   // Go back to copy next '|'
nextB | nextB | L
`;


const sim = new TuringRunner(rules, "||||||||*|||" );
// sim.printTape();
sim.run();
// sim.cpu.runStep("|||*|||");  // auto-runs until halt