import { TuringConfig } from "./TuringBrain.js";
import {  GIFBuilder  } from '../turing_gui/GIFBuilder.js';
import { StateManager } from '../turing_gui/StateManager.js'

class Simulator_GUI {
    docIDs = [
        // Core Controls
        'stepBtn', 'RunPauseBtn', 'resetBtn', 'ControlBtn',
        // Navigation & Step Management
        'gotoBtn', 'gotoStep', 'stepEntry', 'maxSteps', 'historySlider',
        // Tape & Input Handling
        'tapeInput', 'tapeDisplay', 'clearTapeBtn', 'copyTapeBtn',
        // Rules & Configuration
        'rulesText', 'clearRulesBtn', 'copyRulesBtn', 'modelInputName',
        // Status & Feedback
        'stepState', 'machineStatus', 'results', 'resources',
        // GIF Export
        'buildGIF', 'generateGIF', 'cancelGIF', 'gifCard', 'gifContainer', 'gifPreview', 'GIFStatus',
        // File Operations
        'importModal', 'exportModal','importBtn', 'exportBtn', 'saveBtn',
        // Performance
        'delayEntry'
    ];

    EXAMPLES = {
            'unary_increment': 'unary_increment.json',
            'unary_decrement': 'unary_decrement.json',
            // 'Binary Adder': 'binary_adder.json',
            // 'Busy Beaver (3-state)': 'busy_beaver.json'
        };

    constructor() {
        this.init_time = TuringConfig.getTimestamp();
        this.auto_run_timeout = null;
        this.running = false;
        this.modelName = " ";
        this.step_count = 0;
        this.MAX_STEPS = 0;
        this.BASE_STEP = 0;
        this.history = [];
        this.DELAY = 0;

        this.initElements();
        this.setupEventListeners();
        this.setupModalHandlers();
        this.setupDropdown()

        this.stateManager = new StateManager(
            this, window.getRulesText, window.setRulesText,
        );
    }

    initElements() {
        for (const id of this.docIDs) {
            this[id] = document.getElementById(id);
        }
    }

    delElements() {
        this.docIDs.forEach(id => {
            const elem = document.getElementById(id);
            if (elem) {
                const newElem = elem.cloneNode(true);
                elem.parentNode.replaceChild(newElem, elem);
            }
        });
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

        // Copy & Clear buttons setup
        this.copyRulesBtn.addEventListener('click', () => {
            this.stateManager.copyText(window.getRulesText(), "Transition rules");
        });

        this.clearRulesBtn.addEventListener('click', () => {
            this.stateManager.clearText(null, "all transition rules", window.setRulesText.bind(this));
        });

        this.copyTapeBtn.addEventListener('click', () => {
            this.stateManager.copyText(this.tapeInput, "Initial Tape");
        });

        this.clearTapeBtn.addEventListener('click', () => {
            this.stateManager.clearText("tapeInput", "initial Tape");
        });

        // Import and Exports
        this.importBtn.addEventListener("click", () => this.handleImports());
        this.exportBtn.addEventListener("click", () => this.handleExports());
    }

    toggleModal(modalElement, show) {
        if (!modalElement) return;
        modalElement.classList.toggle('active', show);
        document.body.style.overflow = show ? 'hidden' : '';
    }

    setupModalHandlers() {

        this.importBtn?.addEventListener('click', () => this.toggleModal(this.importModal, true));
        this.exportBtn?.addEventListener('click', () => this.toggleModal(this.exportModal, true));

        // Shared close handler
        const closeAllModals = () => {
            this.toggleModal(this.importModal, false);
            this.toggleModal(this.exportModal, false);
        };

        // Close buttons and backdrop
        document.querySelectorAll('.tm-modal-close').forEach(btn => {
            btn.addEventListener('click', closeAllModals);
        });

        // Backdrop click
        [this.importModal, this.exportModal].forEach(modal => {
            modal?.addEventListener('click', (e) => {
                if (e.target === modal) closeAllModals();
            });
        });

    }

    setupDropdown() {
        document.addEventListener('DOMContentLoaded', () => {
            const examplesMenu = document.getElementById('examplesMenu');
            examplesMenu.innerHTML = '';

            // Add examples to dropdown
            Object.entries(this.EXAMPLES).forEach(([displayName, filename]) => {
                const li = document.createElement('li');
                li.innerHTML = `
                    <a class="dropdown-item fst-italic" href="#" data-example="${filename}">
                        ${displayName}
                    </a>
                `;
                li.addEventListener('click', () => this.loadExample(displayName));
                examplesMenu.appendChild(li);
            });

            // Add divider and blank option
            examplesMenu.appendChild(document.createElement('hr')).classList.add('dropdown-divider', 'm-0');

            const blankLi = document.createElement('li');
            blankLi.innerHTML = `
                <a class="dropdown-item fst-italic" href="#" data-example="empty">
                    Blank Machine
                </a>
            `;
            blankLi.addEventListener('click', () => this.resetToBlankMachine());
            examplesMenu.appendChild(blankLi);
        });
    }

    async loadExample(displayName) {
        try {
            const filename = this.EXAMPLES[displayName]
            const response = await fetch(`./example_files/${filename}`);
            if (!response.ok) throw new Error('File not found');

            const exampleConfig = await response.json();
            this.loadState(exampleConfig);

            // Update UI
            document.querySelector('#examplesDropdown').textContent = displayName;
            document.getElementById('modelInputName').value = displayName;
            this.updateMachineStatus(`'${displayName}' Loaded`, "text-secondary");
            this.modelName = displayName;
        } catch (error) {
            console.error('Error loading example:', error);
            alert(`Failed to load example: ${filename}\n${error.message}`);
        }
    }

    resetToBlankMachine() {
        document.querySelector('#examplesDropdown').textContent = 'Select example...';
        document.getElementById('modelInputName').value = '';
        this.tapeInput.value = "",
        this.reset()
        this.rulesNo = 0;
        this.modelName = "";
        window.setRulesText("")
        this.updateMachineStatus(`Empty Model Created`, "text-secondary");

    }

    handleImports() {
        const fileInput = document.getElementById('fileInput');
        const previewElement = document.getElementById("importPreview");
        const importConfirmBtn = document.getElementById('importConfirmBtn');
        const filePreviewContainer = document.getElementById('filePreviewContainer');
        const exportClose = document.getElementById('closeImport');

        let selectedFile = null;
        let loadedFileType = '';
        let file_data = '';

        function clearFilePreview() {
            filePreviewContainer.innerHTML = '';
            selectedFile = null;
            loadedFileType = '';
            previewElement.value = ''
            importConfirmBtn.disabled = true;
        }

        function showFilePreview(file) {
            const chip = document.createElement('div');
            chip.className = 'tm-file-preview-chip';

            const fileNameSpan = document.createElement('span');
            fileNameSpan.textContent = file.name;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.innerHTML = '&times;';
            removeBtn.title = 'Remove file';

            removeBtn.addEventListener('click', () => {
                clearFilePreview();
                fileInput.value = '';
            });

            chip.appendChild(fileNameSpan);
            chip.appendChild(removeBtn);

            filePreviewContainer.appendChild(chip);

            importConfirmBtn.disabled = false;
        }

        function handleFiles(files) {
            if (!files.length) return;

            if (files.length >= 2)
                alert("Multiple files selected. Select a single file model");

            const file = files[0];
            const allowedExts = ['json', 'jsonl', 'yaml', 'txt'];
            const ext = file.name.split('.').pop().toLowerCase();

            if (!allowedExts.includes(ext)) {
                alert('Unsupported file type');
                clearFilePreview();
                return;
            }
            clearFilePreview();

            selectedFile = file;
            loadedFileType = ext;

            showFilePreview(file);
            return selectedFile;
        }

        // Option card click opens file dialog with appropriate accept attribute
        document.querySelectorAll('.tm-option-card').forEach(card => {
            card.addEventListener('click', () => {
                fileInput.accept = `.${card.dataset.type}`;
                fileInput.click();
            });
        });

        // Drag and drop zone setup
        const dropzone = document.querySelector('.tm-file-dropzone');
        if (dropzone) {
            dropzone.addEventListener('click', () => fileInput.click());

            ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(e =>
                dropzone.addEventListener(e, preventDefaults, false)
            );

            ['dragenter', 'dragover'].forEach(e =>
                dropzone.addEventListener(e, () => dropzone.classList.add('highlight'), false)
            );

            ['dragleave', 'drop'].forEach(e =>
                dropzone.addEventListener(e, () => dropzone.classList.remove('highlight'), false)
            );

            dropzone.addEventListener('drop', (e) => handleFiles(e.dataTransfer.files), false);

            function preventDefaults(e) {
                e.preventDefault();
                e.stopPropagation();
            }
        }

        // File input change event triggers handleFiles
        fileInput.addEventListener('change', async (e) => {
            selectedFile = handleFiles(e.target.files);
            e.target.value = '';
            if (loadedFileType === 'json') {
                file_data = await this.stateManager.loadJSON(selectedFile);
                previewElement.value = JSON.stringify(file_data, null, 2);
            } else if (loadedFileType === 'jsonl') {
                file_data = await this.stateManager.loadJSONLines(selectedFile);
                previewElement.value = JSON.stringify(file_data, null, 2);
            } else if (loadedFileType === 'yaml') {
                file_data = await this.stateManager.loadYAML(selectedFile);
                previewElement.value = jsyaml.dump(file_data);
            } else if (loadedFileType === 'txt') {
                file_data = await this.stateManager.loadRules(selectedFile);
                previewElement.value = file_data;
            } else {
                throw new Error('Unsupported file type');
            }
        });

        // Import button click event
        importConfirmBtn.addEventListener('click', async () => {
            if (!selectedFile) {
                alert('No file selected');
                return;
            }

            const file_name = selectedFile.name.replace(/\.[^/.]+$/, '');
            document.getElementById('modelInputName').value = file_name;
            this.modelName = file_name;

            if (loadedFileType === 'txt') {
                window.setRulesText(file_data);
            } else {
                this.loadState(file_data);
            }
            this.updateMachineStatus(`'${file_name}' loaded`, "text-success");
        });

        // Close buttons and backdrop
        exportClose.addEventListener("click", () => {
            clearFilePreview();
        });
    }

    loadState(file_data) {
        // Restore configuration inputs with defaults
        const configMap = {
            LEFT:           ['leftSymbolInput',  'L'],
            RIGHT:          ['rightSymbolInput', 'R'],
            BLANK:          ['blankSymbolInput', '_'],
            INIT_STATE:     ['initStateInput', 'INIT'],
            HALT_STATE:     ['haltStateInput', 'HALT'],
            COMMENT_PREFIX: ['commentSymbolInput', '//'],
            MAX_STATES:     ['maxStatesInput', 1024],
            MAX_STATE_SIZE: ['maxStateSizeInput', 32],
            MAX_TAPE_LEN:   ['maxTapeLenInput', 1048576],
            TRANSITION_SIZE:['transitionSizeInput', 710000]
        };

        Object.entries(configMap).forEach(([key, [elementId, defaultVal]]) => {
            const value = (file_data[key] !== undefined && file_data[key] !== '')
                ? file_data[key]
                : defaultVal;
            document.getElementById(elementId).value = value;
        });

        TuringConfig.updateFromInputs();

        // Restore CPU state
        const cpuDefaults = {
            tape: [],
            input_tape: '',
            running: false,
            head_position: 0,
            current_state: '',
        };

        // Restore transition rules separately
        const rulesText = file_data.rulesText || '';
        window.setRulesText(rulesText);
        const transitions_list = new TuringConfig().parseTransitionRules(file_data.rulesText);
        const new_cpu = new MachineLogic(transitions_list, file_data.INIT_STATE, file_data.HALT_STATE);
        this.cpu = new_cpu;

        Object.keys(cpuDefaults).forEach(key => {
            this.cpu[key] = file_data[key] ?? cpuDefaults[key];
        });

        // Restore UI state
        const uiDefaults = {
            rulesNo: 0,
            max_len: 0,
            tape_len: 0,
            history: [],
            step_count: 0,
            initial_tape: '',
            running: false,
        };

        Object.keys(uiDefaults).forEach(key => {
            this[key] = file_data[key] ?? uiDefaults[key];
        });

        // Update UI elements
        if (this.tapeInput) this.tapeInput.value = this.initial_tape;

        // Update control button
        if (file_data.ControlBtn?.split(" ").includes("btn-reset")) {
            this.updateControlButton('reset');
        } else {
            this.pause(false)
        }
        this.stepBtn.disabled = file_data.stepBtn ?? false;
        this.buildGIF.disabled = file_data.buildGIF ?? false;
        this.RunPauseBtn.disabled = file_data.RunPauseBtn ?? false;

        this.updateUI();
        this.updateResults();
        return true;
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

            this.max_len = 0;
            this.tape_len = 0;
            this.step_count = 0;
            this.running = false;
            this.buildGIF.disabled = true;
            this.stepBtn.disabled = false;
            this.ControlBtn.disabled = false;
            this.RunPauseBtn.disabled = false;
            this.updateControlButton('run');
            this.updateMachineStatus(`Model '${this.modelName}' Loaded`, "text-secondary");
            this.rulesNo = this.cpu.transitions_list.length
            this.history = [{
                tape: { ...this.cpu.tape },
                head: this.cpu.head_position,
                state: this.cpu.current_state,
                move: "N",
            }];

            // Update UI & results
            this.updateUI();
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
            this.buildGIF.disabled = false;
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
                    this.tape_len = Object.keys(this.cpu.tape).length;
                    this.max_len = Math.max(this.max_len, this.tape_len);
                    this.history.push({
                        tape: { ...this.cpu.tape },
                        head: this.cpu.head_position,
                        state: this.cpu.current_state,
                        move: "N",
                        tape_len: this.tape_len,
                    });

                    // Update UI & results
                    this.updateUI();
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

    setAllButtonsDisabled(disabled) {
        document.querySelectorAll('button:not(#cancelGIF)').forEach(btn => {
            btn.disabled = disabled;
        });
    }

    updateUI() {
        // Update tape display
        this.tapeDisplay.innerHTML = "";

        const positions = Object.keys(this.cpu.tape).map(Number);
        const min_pos = positions.length > 0 ? Math.min(...positions) : 0;
        const max_pos = positions.length > 0 ? Math.max(...positions) : 0;

        // Show at least 5 cells before and after the head position
        const start_pos = Math.min(min_pos, this.cpu.head_position) - 7;
        const end_pos = Math.max(max_pos, this.cpu.head_position) + 7;

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
            `   Tape Size: Max = ${this.max_len} | Now = ${this.tape_len} `,
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
        const statusEl = this.machineStatus;
        statusEl.className = `machineStatus fw-bold text-center ${colorClass}`;
        statusEl.textContent = text;
    }

    async generateGIFFromHistory() {
        try {
            this.gifContainer.style.display = 'none';
            this.setAllButtonsDisabled(true);

            // Initialize GIFBuilder
            this.gifBuilder = new GIFBuilder(
                this.tapeDisplay, this.GIFStatus,
                this.modelName, this.rulesNo, this.max_len,
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

    handleExports() {
        const previewElement = document.getElementById("exportPreview");
        const exportFormatRadios = document.querySelectorAll('input[name="exportFormat"]');
        const exportClose = document.getElementById('closeExport');
        let file_data = "";
        let selectedFormat = "";

        // --- Update preview when format changes ---
        exportFormatRadios.forEach(radio => {
            radio.addEventListener("change", () => {
                selectedFormat = document.querySelector('input[name="exportFormat"]:checked').value;
                file_data = this.stateManager.exportFileData(selectedFormat);
                previewElement.value = file_data;
            });
        });

        // --- Download current preview on Save click ---
        this.saveBtn.addEventListener("click", () => {
            this.stateManager.downloadFile(file_data, selectedFormat);
        });

        // Close buttons and clear exsting selections
        exportClose.addEventListener("click", () => {
            exportFormatRadios.forEach(radio => {radio.checked = false;});
            previewElement.value = ""
        });
    }

}

export { Simulator_GUI };

