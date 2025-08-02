import { TuringConfig  } from "./TuringBrain.js";

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
        this.ControlBtn = document.getElementById('ControlBtn');
    }

    setupEventListeners() {
        // Helper function that wraps any callback with scroll-to-top behavior
        const withScrollToTop = (callback) => {
            return (...args) => {
                callback(...args);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        };

        // Apply to all relevant buttons
        this.historySlider.addEventListener('input', withScrollToTop(
            () => this.seekHistory(parseInt(this.historySlider.value))
        ));

        this.copyRulesBtn.addEventListener('click', withScrollToTop(() => this.copyRules()));
        this.clearRulesBtn.addEventListener('click', withScrollToTop(() => this.clearRules()));
        this.loadBtn.addEventListener('click', withScrollToTop(() => this.load()));
        this.resetBtn.addEventListener('click', withScrollToTop(() => this.reset()));
        this.gotoBtn.addEventListener('click', withScrollToTop(() => this.goToStep()));
        this.stepBtn.addEventListener('click', withScrollToTop(() => this.step()));
        this.runBtn.addEventListener('click', withScrollToTop(() => this.run()));
        this.pauseBtn.addEventListener('click', withScrollToTop(() => this.pause()));

        this.ControlBtn.addEventListener('click', () => {
            if (this.running) {
                this.pause();
            } else if (this.cpu?.current_state === this.cpu?.halt_state) {
                this.reset();
            } else {
                this.run();
            }
        });
        this.updateControlButton('run')
    }

    updateControlButton(state) {
        const btn = this.ControlBtn;
        btn.className = 'control-btn'; // Reset classes

        switch(state) {
            case 'run':
                btn.classList.add('btn-run');
                btn.innerHTML = '<i class="bi bi-play-fill"></i>';
                break;
            case 'pause':
                btn.classList.add('btn-pause');
                btn.innerHTML = '<i class="bi bi-pause-fill"></i>';
                break;
            case 'reset':
                btn.classList.add('btn-reset');
                btn.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
                break;
        }
    }

    load() {
        try {
            const rules = this.rulesText.value;
            const transitions = new TuringConfig().parseTransitionRules(rules);
            this.initial_tape = this.tapeInput.value || "||||";
            this.init_time = TuringConfig.getTimestamp();
            this.cpu = new MachineLogic(transitions);
            this.cpu._setTape(this.initial_tape);

            this.step_count = 0;
            this.running = false;
            this.updateControlButton('run');
            this.updateMachineStatus("Machine Loaded", "text-secondary");
            this.runBtn.disabled = false;
            this.pauseBtn.disabled = true;
            this.stepBtn.disabled = false;

            this.history = [{
                tape: { ...this.cpu.tape },
                head: this.cpu.head_position,
                state: this.cpu.current_state
            }];

            this.updateUI();
        } catch (error) {
            console.error("Load error:", error);
            this.updateMachineStatus(error, "text-danger");
            alert(`Error during load: ${error.message}`);
        }
    }

    reset() {
        clearTimeout(this.auto_run_timeout);
        try {
            if (!this.initial_tape) {
                const status = "Initial configuration not loaded. Click 'Load' first."
                this.updateMachineStatus(status, "text-warning")
                alert(status);
                return;
            }
            this.init_time = TuringConfig.getTimestamp();
            this.cpu._setTape(this.initial_tape);
            this.step_count = 0;
            this.running = false;
            this.stepBtn.disabled = false;
            this.runBtn.disabled = false;
            this.updateControlButton('run');
            this.updateMachineStatus("Machine RESET", "text-secondary");

            this.history = [{
                tape: { ...this.cpu.tape },
                head: this.cpu.head_position,
                state: this.cpu.current_state
            }];
            this.updateUI();
        } catch (error) {
            console.error("Reset error:", error);
            this.updateMachineStatus(error, "text-danger");
            alert(`Error during reset: ${error.message}`);
        }
    }

    run() {
        this.running = true;
        this.stepBtn.disabled = true;

        this.runBtn.disabled = true;
        this.pauseBtn.disabled = false;
        this.updateControlButton('pause');
        this.autoStep();
    }

    pause(printPause = true) {
        if (printPause) {
            this.updateMachineStatus(`Machine Paused after ${this.step_count} steps`, "text-warning");
        }
        this.running = false;
        clearTimeout(this.auto_run_timeout);
        this.updateControlButton('run');
        this.runBtn.disabled = false;
        this.pauseBtn.disabled = true;
        this.stepBtn.disabled = false;
    }

    HALT() {
        this.running = false;
        this.stepBtn.disabled = true;
        this.runBtn.disabled = true;
        this.pauseBtn.disabled = true;
        this.updateControlButton('reset');
        const textContent = `Machine HALTED | Total Steps: ${this.step_count}`;
        this.updateMachineStatus(textContent, "text-success");    // On halt
    }

    step(printStep = true) {
        try {
            const steps_to_run = parseInt(this.stepEntry.value) || this.BASE_STEP;
            const max_allowed = parseInt(this.maxSteps.value) || this.MAX_STEPS;
            if (printStep) {
                this.updateMachineStatus(`Machine ran for ${steps_to_run} steps`, "text-primary");              // When started
            }
            for (let i = 0; i < steps_to_run; i++) {
                if (this.step_count >= max_allowed) {
                    this.updateMachineStatus(`Max steps (${max_allowed}) reached`, "text-danger");
                    this.pause(false);
                    break;
                }
                if (this.cpu.current_state === this.cpu.halt_state) {
                    this.HALT();
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
                    const textContent = `Machine STUCK | After ${this.step_count} steps`;
                    this.updateMachineStatus(textContent, "text-danger");
                    this.pause(false);
                    throw error;
                }
            }
        } catch (error) {
            console.error("Step error:", error);
            this.updateMachineStatus(error, "text-danger");
            alert(`Error during step: ${error.message}`);
        }
    }

    autoStep() {
        if (!this.running) return;
        if (this.cpu.current_state === this.cpu.halt_state) {
            this.HALT();
            return;
        }
        this.updateMachineStatus("Machine AutoRun", "text-primary");              // When started

        this.step(false);

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
        // Scroll the active cell horizontally without affecting vertical position
        const activeCell = this.tapeDisplay.querySelector('.active');
        if (activeCell) {
            activeCell.scrollIntoView({
                behavior: 'auto',
                block: 'nearest',  // This prevents vertical scrolling
                inline: 'center'   // This handles horizontal scrolling
            });
        }

        // Restore vertical scroll position
        window.scrollTo(0, scrollY);


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
        this.cpu.stepCount = this.step_count;
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

    updateMachineStatus(text, colorClass = "text-primary") {
        const statusEl = document.getElementById("machineStatus");
        statusEl.className = `fw-bold text-center ${colorClass}`;
        statusEl.textContent = text;
    }
}


export { TuringSimulator_GUI };

