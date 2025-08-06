import { TuringConfig  } from "./TuringBrain.js";
import { GIFBuilder } from '../turing_gui/GIFBuilder.js';

class Simulator_GUI {
    constructor() {
        this.init_time = TuringConfig.getTimestamp();
        this.modelName = "turing_test";
        this.auto_run_timeout = null;
        this.running = false;
        this.history = [];
        this.MAX_STEPS = 0;
        this.BASE_STEP = 0;
        this.DELAY = 0;
        this.step_count = 0;

        this.initElements();
        this.setupEventListeners();
        this.reset();
    }

    initElements() {
        const ids = [
            'gotoBtn', 'maxSteps', 'resetBtn', 'gotoStep', 'stepEntry', 'saveBtn',
            'tapeInput', 'rulesText', 'stepState', 'delayEntry', 'tapeDisplay',
            'RunPauseBtn', 'copyRulesBtn', 'historySlider', 'machineStatus',
            'clearRulesBtn', 'stepBtn', 'results', 'uploadBtn', 'fileInput',
            'resources', 'ControlBtn', 'buildGIF', 'generateGIF',
            'gifCard', 'gifContainer', 'gifPreview', 'GIFStatus',
            'cancelGIF', 'modelInputName',
        ];

        for (const id of ids) {
            this[id] = document.getElementById(id);
        }
    }

    setupEventListeners() {
        const withScrollToTop = (callback) => {
            return (...args) => {
                callback(...args);
                window.scrollTo({ top: 0, behavior: 'smooth' });
            };
        };

        this.modelInputName.addEventListener('input', () => {
            this.modelName = this.modelInputName.value.trim() || "turing_test";
        });

        // Upload and load/reset
        this.uploadBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.uploadRules(e));

        // Rules and state
        this.copyRulesBtn.addEventListener('click', () => this.copyRules());
        this.clearRulesBtn.addEventListener('click', () => this.clearRules());
        this.saveBtn.addEventListener("click", () => this.downloadRules());

        // Navigation and step controls
        this.resetBtn.addEventListener('click', withScrollToTop(() => this.reset()));
        this.gotoBtn.addEventListener('click', withScrollToTop(() => this.goToStep()));
        this.stepBtn.addEventListener('click', withScrollToTop(() => this.step()));
        this.historySlider.addEventListener('input', withScrollToTop(() =>
            this.seekHistory(parseInt(this.historySlider.value))
        ));

        // Run/Pause logic
        this.RunPauseBtn.addEventListener('click', withScrollToTop(() => this.ControlBtn.click()));
        this.ControlBtn.addEventListener('click', () => {
            if (this.running) {
                this.pause();
            } else if (this.cpu?.current_state === this.cpu?.halt_state) {
                this.reset();
            } else {
                this.run();
            }
        });

        this.updateControlButton('run');

        // Show GIF card
        this.buildGIF.addEventListener("click", () => {
            if (this.history?.length >= 2) {
                this.gifCard.style.display = "block";
            } else {
                alert("Not enough history to generate a GIF. Please run the machine first.");
            }
        });

        // Generate GIF from captured frames
        this.generateGIF.addEventListener("click", () => this.generateGIFFromHistory());

        this.cancelGIF.addEventListener("click", () => {
            if (this.gifBuilder.isBuilding){
                this.gifBuilder.cancel()
                this.setAllButtonsDisabled(false)
            }
        });
    }

    uploadRules(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        document.getElementById('modelInputName').value = file.name.replace(/\.[^/.]+$/, '');

        reader.onload = (e) => {
            try {
                const text = e.target.result.trim();
                window.setRulesText(text);
                this.stepBtn.disabled = true;
                this.RunPauseBtn.disabled = true;
                this.ControlBtn.disabled = true;
            } catch (error) {
                console.error("Error loading file:", error);
                this.updateMachineStatus("Error loading file", "text-danger");
                alert(`Error loading file: ${error.message}`);
            }
        };

        reader.onerror = () => {
            this.updateMachineStatus("Error reading file", "text-danger");
            alert("Error reading file");
        };

        reader.readAsText(file);
    }

    reset() {
        try {
            clearTimeout(this.auto_run_timeout);
            const rules = window.getRulesText(); // Using the Ace Editor content
            this.gifCard.style.display = "none";
            this.gifContainer.style.display = 'none';
            this.GIFStatus.textContent = "No GIF Created yet"
            const transitions = new TuringConfig().parseTransitionRules(rules);
            this.initial_tape = this.tapeInput.value;
            this.init_time = TuringConfig.getTimestamp();
            this.cpu = new MachineLogic(transitions);
            this.cpu._setTape(this.initial_tape);

            this.step_count = 0;
            this.running = false;
            this.buildGIF.disabled = true;
            this.stepBtn.disabled = false;
            this.RunPauseBtn.disabled = false;
            this.ControlBtn.disabled = false;
            this.updateControlButton('run');
            this.updateMachineStatus(`Model '${this.modelName}' Loaded`, "text-secondary");
            this.rulesNo = this.cpu.transitions_list.length
            this.history = [{
                tape: { ...this.cpu.tape },
                head: this.cpu.head_position,
                state: this.cpu.current_state,
                move: "N",
            }];

            this.updateUI();

            // Update results
            this.updateResults();

        } catch (error) {
            console.error("Load error:", error);
            this.updateMachineStatus(error, "text-danger");
            alert(`Error during load: ${error.message}`);
        }
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
                    this.history[this.step_count -1]['move'] = this.cpu.headMove;

                    this.history.push({
                        tape: { ...this.cpu.tape },
                        head: this.cpu.head_position,
                        state: this.cpu.current_state,
                        move: "N",
                    });

                    this.updateUI();

                    // Update results
                    this.updateResults();
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

    pause(printPause = true) {
        if (printPause) {
            this.updateMachineStatus(`Machine Paused after ${this.step_count} steps`, "text-warning");
        }
        this.running = false;
        clearTimeout(this.auto_run_timeout);
        this.updateControlButton('run');
        this.stepBtn.disabled = false;
        this.buildGIF.disabled = false;
    }

    HALT() {
        this.running = false;
        this.stepBtn.disabled = true;
        this.RunPauseBtn.disabled = true
        this.buildGIF.disabled = false;

        this.updateControlButton('reset');
        const textContent = `Machine HALTED | Total Steps: ${this.step_count}`;
        this.updateMachineStatus(textContent, "text-success");    // On halt
    }

    run() {
        this.running = true;
        this.stepBtn.disabled = true;
        this.buildGIF.disabled = true;


        this.updateControlButton('pause');
        this.autoStep();
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

    }

    updateResults() {
        this.cpu.stepCount = this.step_count;
        const final_tape = this.cpu._printTapeState();
        const resources_used = [
            `    Time run: ${(TuringConfig.getTimestamp() - this.init_time).toFixed(5)}s`,
            ` Memory used: ${TuringConfig.getCurrentMemoryMB()}MB`
        ];

        const results = [
            `Initial Tape: '${this.initial_tape}'`,
            ` Result Tape: '${final_tape}'`,
            ` Steps Count: ${this.step_count}`,
            ` Total Rules: ${this.rulesNo}`,
            ...resources_used
        ];

        this.results.innerHTML = results.join('<br>');
    }

    updateStepState() {
        const step = parseInt(this.historySlider.value);
        const prev = step > 0 ? this.history[step - 1].state : "--";
        const curr = this.history[step].state;
        const next = step + 1 < this.history.length ? this.history[step + 1].state : 
            (step === this.step_count ? "--" : "--");
        this.stepState.innerHTML = ` Step [${step}]: ${prev} <- <span class="tape-current">${curr}</span> -> ${next}`;
    }

    updateControlButton(state) {
        const btn_ctrl = this.ControlBtn;
        btn_ctrl.className = 'control-btn'; // Reset classes

        const btn_rp = this.RunPauseBtn;
        btn_rp.className = 'btn w-100 action-btn';

        switch(state) {
            case 'run':
                btn_ctrl.classList.add('btn-run');
                btn_rp.classList.add('btn-run');
                btn_ctrl.innerHTML = '<i class="bi bi-play-fill"></i>';
                btn_rp.innerHTML = '<i class="w-100 bi bi-play-fill"></i>Play';
                break;
            case 'pause':
                btn_ctrl.classList.add('btn-pause');
                btn_rp.classList.add('btn-pause');
                btn_ctrl.innerHTML = '<i class="bi bi-pause-fill"></i>';
                btn_rp.innerHTML = '<i class="w-100 bi bi-pause-fill"></i>Stop';
                break;
            case 'reset':
                btn_ctrl.classList.add('btn-reset');
                btn_rp.classList.add('btn-run');
                btn_ctrl.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
                btn_rp.innerHTML = '<i class="w-100 bi bi-play-fill"></i>Play';
                break;
        }
    }

    updateMachineStatus(text, colorClass = "text-primary") {
        const statusEl = document.getElementById("machineStatus");
        statusEl.className = `machineStatus fw-bold text-center ${colorClass}`;
        statusEl.textContent = text;
    }

    setAllButtonsDisabled(disabled) {
        document.querySelectorAll('button:not(#cancelGIF)').forEach(btn => {
            btn.disabled = disabled;
        });
    }

    async generateGIFFromHistory() {
        try {
            this.gifContainer.style.display = 'none';
            this.setAllButtonsDisabled(true);

            // Initialize GIFBuilder
            this.gifBuilder = new GIFBuilder(
                this.tapeDisplay, this.GIFStatus,
                this.modelName, this.rulesNo,
            );

            // Generate GIF
            const blob = await this.gifBuilder.buildFromHistory(
                this.history, (step) => this.seekHistory(step)
            );

        } catch (error) {
            console.error("GIF generation error:", error);
            this.gifProgress.textContent = `Error: ${error.message}`;
        } finally {
            this.setAllButtonsDisabled(false);
        }
    }

    copyRules() {
        const rules = window.getRulesText();

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
            window.setRulesText("");
        }
    }

    downloadRules() {
        const rulesText = window.getRulesText(); // Get current rules from Ace or text storage
        const blob = new Blob([rulesText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${this.modelName}.txt`;
        a.style.display = "none";

        document.body.appendChild(a);
        a.click();

        // Cleanup
        setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);
    }

    toJSON() {
        return {
            step_count: this.step_count,
            running: this.running,
            initial_tape: this.initial_tape,
            history: this.history,
            transitions: this.cpu?.transitions,
            head_position: this.cpu?.head_position,
            current_state: this.cpu?.current_state,
            halt_state: this.cpu?.halt_state,
            tape: this.cpu?.tape,
            rulesText: window.getRulesText(), // From Ace Editor or wherever you're storing rules
        };
    }

    downloadJSON() {
        const data = this.toJSON();
        const jsonStr = JSON.stringify(data, null, 2); // Pretty-print
        const blob = new Blob([jsonStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.modelName}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    uploadState(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target.result);
                if (!json || typeof json !== "object") throw new Error("Invalid file format");

                // Set rules text from saved string
                window.setRulesText(json.rulesText || "");

                // Restore machine state
                this.initial_tape = json.initial_tape || "";
                this.cpu = new MachineLogic(json.transitions || []);
                this.cpu._setTape(this.initial_tape);
                this.cpu.head_position = json.head_position || 0;
                this.cpu.current_state = json.current_state || "q0";
                this.cpu.halt_state = json.halt_state || "halt";
                this.cpu.tape = json.tape || {};

                this.step_count = json.step_count || 0;
                this.running = false; // Always reset running state

                this.history = json.history || [{
                    tape: { ...this.cpu.tape },
                    head: this.cpu.head_position,
                    state: this.cpu.current_state,
                    move: "N",
                }];

                this.updateControlButton('run');
                this.stepBtn.disabled = false;
                this.RunPauseBtn.disabled = false;
                this.updateUI();
                this.updateResults();
                this.updateMachineStatus("Machine state loaded", "text-success");

            } catch (error) {
                console.error("Error loading state file:", error);
                this.updateMachineStatus("Invalid or corrupted state file", "text-danger");
                alert(`Error loading file: ${error.message}`);
            }
        };

        reader.onerror = () => {
            this.updateMachineStatus("Error reading file", "text-danger");
            alert("Error reading file");
        };

        reader.readAsText(file);
    }

}


export { Simulator_GUI };

