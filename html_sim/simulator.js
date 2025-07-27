class TuringMachineSimulator {
    constructor() {
        this.init_time = TuringConfig.getTimestamp();
        this.init_memory = TuringConfig.getCurrentMemoryMB();
        this.MAX_STEPS = 1000000;
        this.BASE_STEP = 1;
        this.DELAY = 300;
        this.step_count = 0;
        this.running = false;
        this.auto_run_timeout = null;

        // DOM elements
        this.tapeDisplay = document.getElementById('tapeDisplay');
        this.statusLabel = document.getElementById('statusLabel');
        this.haltLabel = document.getElementById('haltLabel');
        this.rulesText = document.getElementById('rulesText');
        this.tapeInput = document.getElementById('tapeInput');
        this.stepEntry = document.getElementById('stepEntry');
        this.maxSteps = document.getElementById('maxSteps');
        this.delayEntry = document.getElementById('delayEntry');
        this.resetBtn = document.getElementById('resetBtn');
        this.stepBtn = document.getElementById('stepBtn');
        this.runBtn = document.getElementById('runBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.results = document.getElementById('results');

        // Event listeners
        this.resetBtn.addEventListener('click', () => this.reset());
        this.stepBtn.addEventListener('click', () => this.step());
        this.runBtn.addEventListener('click', () => this.run());
        this.pauseBtn.addEventListener('click', () => this.pause());

        // Initialize
        this.reset();
    }

    parseTransitionRules(transitionRulesStr) {
        const transitionsList = [];
        const rawRuleList = transitionRulesStr.split("\n");

        for (const rawLine of rawRuleList) {
            const line = rawLine.trim();
            if (!line || line.startsWith("//")) {
                continue;
            }

            // Remove inline comments
            const cleanedLine = line.split("//")[0].trim();
            const values = cleanedLine.split(/\s+/).filter(val => val.trim());

            if (values.length !== 5) {
                throw new Error(`Invalid transition: ${values}. Expected 5 elements got ${values.length}`);
            }

            const [currentState, currentSymbol, newState, newSymbol, direction] = values;
            if (direction !== "L" && direction !== "R") {
                throw new Error(`Invalid moveDirection: ${direction}. Must be L or R`);
            }

            for (const [symbol, label] of [[currentSymbol, "current"], [newSymbol, "new"]]) {
                if (symbol.length !== 1) {
                    throw new Error(`Invalid ${label}_symbol: '${symbol}'. Must be a single character.`);
                }
            }

            transitionsList.push([currentState, currentSymbol, newState, newSymbol, direction]);
        }

        return transitionsList;
    }

    reset() {
        clearTimeout(this.auto_run_timeout);
        
        try {
            const rules = this.rulesText.value;
            const transitions = this.parseTransitionRules(rules);
            this.initial_tape = this.tapeInput.value;
            
            this.cpu = new MachineLogic(transitions);
            this.cpu._setTape(this.initial_tape);
            this.cpu.running = true;
            this.step_count = 0;
            this.running = false;
            
            this.haltLabel.textContent = "";
            this.runBtn.disabled = false;
            this.pauseBtn.disabled = true;
            
            this.updateDisplay();
            this.updateResults();
        } catch (error) {
            alert(`Error during reset: ${error.message}`);
        }
    }

    run() {
        this.running = true;
        this.runBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.autoStep();
    }

    pause() {
        this.running = false;
        clearTimeout(this.auto_run_timeout);
        this.runBtn.disabled = false;
        this.pauseBtn.disabled = true;
    }

    step() {
        try {
            const steps_to_run = parseInt(this.stepEntry.value) || this.BASE_STEP;
            const max_allowed = parseInt(this.maxSteps.value) || this.MAX_STEPS;

            if (this.step_count >= max_allowed) {
                this.haltLabel.textContent = `Max steps (${max_allowed}) reached`;
                this.pause();
                return;
            }

            if (this.cpu.current_state === this.cpu.halt_state) {
                this.haltLabel.textContent = "Machine HALTED";
                this.pause();
                return;
            }

            try {
                const [tape, steps, rules] = this.cpu.runMultipleSteps(steps_to_run, max_allowed);
                this.step_count += steps;
                this.updateDisplay();
                this.updateResults();
            } catch (error) {
                alert(`Error during step: ${error.message}`);
                this.haltLabel.textContent = "Machine STUCK";
                this.pause();
            }
        } catch (error) {
            alert(`Error: ${error.message}`);
        }
    }

    autoStep() {
        if (!this.running) return;
        
        if (this.cpu.current_state === this.cpu.halt_state) {
            this.haltLabel.textContent = "Machine HALTED";
            this.pause();
            return;
        }
        
        this.step();
        
        const delay = parseInt(this.delayEntry.value) || this.DELAY;
        this.auto_run_timeout = setTimeout(() => this.autoStep(), delay);
    }

    updateDisplay() {
        // Clear tape display
        this.tapeDisplay.innerHTML = "";
        
        // Get tape boundaries (show 21 cells centered around head)
        const min_pos = this.cpu.head_position - 10;
        
        // Create tape cells
        for (let i = 0; i < 21; i++) {
            const pos = min_pos + i;
            const symbol = this.cpu.tape[pos] !== undefined ? this.cpu.tape[pos] : this.cpu.blank_symbol;
            
            const cell = document.createElement('div');
            cell.className = 'tape-cell';
            cell.textContent = symbol;
            
            if (pos === this.cpu.head_position) {
                cell.classList.add('active');
            }
            
            this.tapeDisplay.appendChild(cell);
        }
        
        // Update status
        this.statusLabel.textContent = `State: ${this.cpu.current_state} | Step: ${this.step_count}`;
    }

    updateResults() {
        const final_tape = this.cpu._printTapeState(false);
        const resources_used = [
            `Time run: ${(TuringConfig.getTimestamp() - this.init_time).toFixed(5)}s`,
            // Memory usage not available in browser JS
        ];

        const results = [
            `Result Tape: '${final_tape}'`,
            `Steps Count: ${this.step_count}`,
            `Total Rules: ${this.cpu.transitions_list.length}`,
            ...resources_used
        ];

        this.results.innerHTML = results.join('<br>');
    }
}

// Initialize the simulator when the page loads
document.addEventListener('DOMContentLoaded', () => {
    const simulator = new TuringMachineSimulator();
});