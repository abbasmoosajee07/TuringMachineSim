// StateManager.js

class StateManager {
    constructor(guiInstance, getRulesText, setRulesText) {
        this.gui = guiInstance; // Store the whole Simulator_GUI object
        this.getRulesText = getRulesText;
        this.setRulesText = setRulesText;
    }

    getCPU() {
        return this.gui.cpu;
    }

    setCPU(cpu) {
        this.gui.cpu = cpu;
    }

    copyRules() {
        const rules = this.getRulesText();
        if (!rules.trim()) return alert("No rules to copy");

        navigator.clipboard.writeText(rules)
            .then(() => alert("Transition rules copied to clipboard"))
            .catch(err => {
                console.error("Failed to copy rules:", err);
                alert("Failed to copy rules. Please try again.");
            });
    }

    clearRules() {
        if (confirm("Clear all transition rules?")) {
            this.setRulesText("");
        }
    }

    uploadRules(file, onUIUpdate) {
        if (!file) return;

        const reader = new FileReader();
        document.getElementById('modelInputName').value =
            file.name.replace(/\.[^/.]+$/, '');

        reader.onload = (e) => {
            try {
                const text = e.target.result.trim();
                this.setRulesText(text);
                onUIUpdate?.();
            } catch (error) {
                console.error("Error loading file:", error);
                alert(`Error loading file: ${error.message}`);
            }
        };

        reader.readAsText(file);
    }

    downloadRules() {
        const rulesText = this.getRulesText();
        const blob = new Blob([rulesText], { type: "text/plain" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${this.gui.modelName}.txt`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }, 100);
    }

    async loadStateFromPath(filePath) {
        try {
            // Fetch the JSON file
            const response = await fetch(filePath);
            if (!response.ok) throw new Error(`Failed to fetch: ${response.status}`);

            // Convert to JSON
            const jsonData = await response.json();

            // Create a File object that loadState expects
            const jsonBlob = new Blob([JSON.stringify(jsonData)], {type: 'application/json'});
            const jsonFile = new File([jsonBlob], filePath.split('/').pop());

            // Call your existing loadState
            return jsonFile;
        } catch (error) {
            console.error('Error loading template:', error);
            this.updateMachineStatus(`Template load failed: ${error.message}`, "text-danger");
            throw error;
        }
    }

    saveState() {
        const {
            LEFT, RIGHT, BLANK, INIT_STATE, HALT_STATE, COMMENT_PREFIX,
            MAX_STATES, MAX_TAPE_LEN, MAX_STATE_SIZE, TRANSITION_SIZE
        } = TuringConfig;

        const cpu = this.getCPU();
        // const gui = this.getGui();
        const cpuState = cpu ? {
            head_position: cpu.head_position,
            current_state: cpu.current_state,
            input_tape: cpu.input_tape,
            running: cpu.running,
            tape: cpu.tape
        } : {};

        return {
            LEFT, RIGHT, BLANK, INIT_STATE, HALT_STATE, COMMENT_PREFIX,
            MAX_STATES, MAX_TAPE_LEN, MAX_STATE_SIZE, TRANSITION_SIZE,
            rulesText: this.getRulesText(),
            rulesNo: this.gui.rulesNo,
            max_len: this.gui.max_len,
            history: this.gui.history,
            tape_len: this.gui.tape_len,
            step_count: this.gui.step_count,
            initial_tape: this.gui.initial_tape,
            ...cpuState,
            buildGIF:  document.getElementById("buildGIF").disabled,
            stepBtn: document.getElementById("stepBtn").disabled,
            RunPauseBtn:  document.getElementById("RunPauseBtn").disabled,
            ControlBtn:  document.getElementById("ControlBtn").className,
        };
    }

    downloadJSON() {
        const jsonStr = JSON.stringify(this.saveState(), null, 2);
        const blob = new Blob([jsonStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");
        a.href = url;
        a.download = `${this.gui.modelName}.json`;
        a.click();

        URL.revokeObjectURL(url);
    }

    loadJSON(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error("No file provided"));
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const json = JSON.parse(e.target.result);
                    if (!json || typeof json !== "object") {
                        throw new Error("Invalid file format");
                    }
                    resolve(json); // ✅ return the JSON to the caller
                } catch (error) {
                    console.error("Error loading state file:", error);
                    alert(`Error loading file: ${error.message}`);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error("Error reading file"));
            };

            reader.readAsText(file);
        });
    }

    downloadJSONLines() {
        const data = this.saveState();
        const lines = [];

        // 1. Add metadata (everything except history) as the first line
        const { history, ...metadata } = data;
        lines.push(JSON.stringify(metadata));

        // 2. Add each history entry as a separate line
        if (history && history.length > 0) {
            history.forEach(entry => {
                lines.push(JSON.stringify(entry));
            });
        }

        // 3. Join with newlines and create blob
        const jsonlStr = lines.join('\n');
        const blob = new Blob([jsonlStr], { type: 'application/jsonl' });

        // 4. Download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.gui.modelName}.jsonl`; // or .ndjson
        a.click();

        URL.revokeObjectURL(url);
    }

    async loadJSONLines(file) {
        if (!file) {
            throw new Error("No file provided");
        }

        const text = await file.text();
        const lines = text.split('\n').filter(line => line.trim());

        if (lines.length === 0) {
            throw new Error("File is empty");
        }

        // 1. Parse metadata (first line)
        let state;
        try {
            state = JSON.parse(lines[0]);
        } catch (error) {
            throw new Error(`Invalid metadata (line 1): ${error.message}`);
        }

        // 2. Parse history entries (remaining lines)
        if (lines.length > 1) {
            state.history = [];
            for (let i = 1; i < lines.length; i++) {
                try {
                    const entry = JSON.parse(lines[i]);
                    state.history.push(entry);
                } catch (error) {
                    console.warn(`Skipping invalid history entry (line ${i + 1})`, error);
                    // Optionally: Continue or throw an error
                }
            }
        }

        // 3. Validate critical fields (customize as needed)
        const requiredFields = ["INIT_STATE", "HALT_STATE", "tape", "current_state"];
        for (const field of requiredFields) {
            if (state[field] === undefined) {
                throw new Error(`Missing required field: ${field}`);
            }
        }

        return state;
    }

}

export {StateManager}