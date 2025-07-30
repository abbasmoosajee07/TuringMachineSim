class TuringSimulator_GUI {
    constructor() {
        this.init_time = TuringConfig.getTimestamp();
        this.MAX_STEPS = 1000000;
        this.BASE_STEP = 1;
        this.DELAY = 300;
        this.step_count = 0;
        this.running = false;
        this.auto_run_timeout = null;
        this.history = [];

        this.initElements();
        this.setupEventListeners();
        this.load();
    }

    initElements() {
        this.historySlider = document.getElementById('historySlider');
        this.gotoStep = document.getElementById('gotoStep');
        this.gotoBtn = document.getElementById('gotoBtn');
        this.stepState = document.getElementById('stepState');
        this.tapeDisplay = document.getElementById('tapeDisplay');
        this.machineStatus = document.getElementById('machineStatus');
        this.rulesText = document.getElementById('rulesText');
        this.tapeInput = document.getElementById('tapeInput');
        this.stepEntry = document.getElementById('stepEntry');
        this.maxSteps = document.getElementById('maxSteps');
        this.delayEntry = document.getElementById('delayEntry');
        this.loadBtn = document.getElementById('loadBtn');
        this.resetBtn = document.getElementById('resetBtn');
        this.copyRulesBtn = document.getElementById('copyRulesBtn');
        this.clearRulesBtn = document.getElementById('clearRulesBtn');
        this.stepBtn = document.getElementById('stepBtn');
        this.runBtn = document.getElementById('runBtn');
        this.pauseBtn = document.getElementById('pauseBtn');
        this.results = document.getElementById('results');
        this.resources = document.getElementById('resources');
    }

    setupEventListeners() {
        this.historySlider.addEventListener('input', () => this.seekHistory(parseInt(this.historySlider.value)));
        this.gotoBtn.addEventListener('click', () => this.goToStep());
        this.loadBtn.addEventListener('click', () => this.load());
        this.resetBtn.addEventListener('click', () => this.reset());
        this.copyRulesBtn.addEventListener('click', () => this.copyRules());
        this.clearRulesBtn.addEventListener('click', () => this.clearRules());
        this.stepBtn.addEventListener('click', () => this.step());
        this.runBtn.addEventListener('click', () => this.run());
        this.pauseBtn.addEventListener('click', () => this.pause());
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
                throw new Error(`Invalid transition: "${cleanedLine}". Expected 5 elements, got ${values.length}`);
            }

            const [currentState, currentSymbol, newState, newSymbol, direction] = values;
            if (direction !== "L" && direction !== "R") {
                throw new Error(`Invalid move direction: '${direction}' in line "${cleanedLine}". Must be 'L' or 'R'.`);
            }

            for (const [symbol, label] of [[currentSymbol, "current"], [newSymbol, "new"]]) {
                if (symbol.length !== 1) {
                    throw new Error(`Invalid ${label}_symbol '${symbol}'. Must be a single character.`);
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
        try {
            const rules = this.rulesText.value;
            const transitions = this.parseTransitionRules(rules);
            this.initial_tape = this.tapeInput.value || "||||";
            this.init_time = TuringConfig.getTimestamp();
            this.cpu = new MachineLogic(transitions);
            this.cpu._setTape(this.initial_tape);

            this.step_count = 0;
            this.running = false;
            this.machineStatus.textContent = "";

            this.history = [{
                tape: { ...this.cpu.tape },
                head: this.cpu.head_position,
                state: this.cpu.current_state
            }];

            this.updateUI();
        } catch (error) {
            console.error("Load error:", error);
            alert(`Error during load: ${error.message}`);
        }
    }

    reset() {
        clearTimeout(this.auto_run_timeout);
        try {
            if (!this.initial_tape) {
                alert("Initial configuration not loaded. Click 'Load' first.");
                return;
            }
            this.init_time = TuringConfig.getTimestamp();
            this.cpu._setTape(this.initial_tape);
            this.step_count = 0;
            this.running = false;
            this.machineStatus.textContent = "";

            this.history = [{
                tape: { ...this.cpu.tape },
                head: this.cpu.head_position,
                state: this.cpu.current_state
            }];
            this.updateUI();
        } catch (error) {
            console.error("Reset error:", error);
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

            for (let i = 0; i < steps_to_run; i++) {
                if (this.step_count >= max_allowed) {
                    this.machineStatus.textContent = `Max steps (${max_allowed}) reached`;
                    this.pause();
                    break;
                }

                if (this.cpu.current_state === this.cpu.halt_state) {
                    this.machineStatus.textContent = `Machine HALTED | Total Steps: ${this.step_count}`;
                    this.pause();
                    break;
                }

                try {
                    this.cpu._stepLogic();
                    this.step_count++;
                    
                    this.history.push({
                        tape: { ...this.cpu.tape },
                        head: this.cpu.head_position,
                        state: this.cpu.current_state
                    });
                    
                    this.updateUI();
                    
                } catch (error) {
                    this.machineStatus.textContent = `Machine STUCK | After ${this.step_count} steps`;
                    this.pause();
                    throw error;
                }
            }
        } catch (error) {
            console.error("Step error:", error);
            alert(`Error during step: ${error.message}`);
        }
    }

    autoStep() {
        if (!this.running) return;
        if (this.cpu.current_state === this.cpu.halt_state) {
            this.machineStatus.textContent = `Machine HALTED | Total Steps: ${this.step_count}`;
            this.pause();
            return;
        }

        this.step();

        const delay = parseInt(this.delayEntry.value) || this.DELAY;
        this.auto_run_timeout = setTimeout(() => this.autoStep(), delay);
    }

    updateUI() {
        // Update tape display
        this.tapeDisplay.innerHTML = "";

        const positions = Object.keys(this.cpu.tape).map(Number);
        const min_pos = positions.length > 0 ? Math.min(...positions) : 0;
        const max_pos = positions.length > 0 ? Math.max(...positions) : 0;

        // Show at least 5 cells before and after the head position
        const start_pos = Math.min(min_pos, this.cpu.head_position) - 5;
        const end_pos = Math.max(max_pos, this.cpu.head_position) + 5;

        for (let pos = start_pos; pos <= end_pos; pos++) {
            const cell = document.createElement('div');
            cell.className = 'tape-cell';
            cell.textContent = this.cpu.tape[pos] !== undefined ? this.cpu.tape[pos] : this.cpu.blank_symbol;
            if (pos === this.cpu.head_position) {
                cell.classList.add('active');
            }
            this.tapeDisplay.appendChild(cell);
        }
        
        // Center the active cell
        const activeCell = this.tapeDisplay.querySelector('.active');
        if (activeCell) {
            activeCell.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
        
        // Update status
        this.historySlider.max = this.history.length - 1;
        this.historySlider.value = this.step_count;
        this.gotoStep.value = this.step_count;
        
        // Update step state display
        this.updateStepState();
        
        // Update results
        this.updateResults();
    }

    updateResults() {
        const final_tape = this.cpu._printTapeState();
        const resources_used = [
            `Time run: ${(TuringConfig.getTimestamp() - this.init_time).toFixed(5)}s`,
            `Memory used: ${TuringConfig.getCurrentMemoryMB()}MB`
        ];

        const results = [
            `Result Tape: '${final_tape}'`,
            `Steps Count: ${this.step_count}`,
            `Total Rules: ${this.cpu.transitions_list.length}`,
            ...resources_used
        ];

        this.results.innerHTML = results.join('<br>');
    }

    seekHistory(step) {
        step = parseInt(step);
        if (isNaN(step)) return;

        if (step < 0 || step >= this.history.length) {
            return;
        }

        const snapshot = this.history[step];
        this.cpu.tape = { ...snapshot.tape };
        this.cpu.head_position = snapshot.head;
        this.cpu.current_state = snapshot.state;
        this.step_count = step;
        this.updateUI();
    }

    updateStepState() {
        const step = parseInt(this.historySlider.value);
        const prev = step > 0 ? this.history[step - 1].state : "--";
        const curr = this.history[step].state;
        const next = step + 1 < this.history.length ? this.history[step + 1].state : 
            (step === this.step_count ? "--" : "--");
        this.stepState.innerHTML = ` Step [${step}]: ${prev} <- <span class="tape-current">${curr}</span> -> ${next}`;

    }

    goToStep() {
        const step = parseInt(this.gotoStep.value);
        if (isNaN(step)) {
            alert("Please enter a valid step number");
            return;
        }

        if (step < 0 || step > this.history.length - 1) {
            alert(`Step must be between 0 and ${this.history.length - 1}`);
            return;
        }

        this.historySlider.value = step;
        this.seekHistory(step);
    }

    copyRules() {
        const rules = this.rulesText.value;
        if (!rules.trim()) {
            alert("No rules to copy");
            return;
        }

        navigator.clipboard.writeText(rules)
            .then(() => alert("Transition rules copied to clipboard"))
            .catch(err => {
                console.error("Failed to copy rules:", err);
                alert("Failed to copy rules. Please try again.");
            });
    }

    clearRules() {
        if (confirm("Are you sure you want to clear all transition rules?")) {
            this.rulesText.value = "";
        }
    }
}

export { TuringSimulator_GUI };
