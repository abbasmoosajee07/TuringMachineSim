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

    copyText(source, label) {
        const text = (typeof source === "string") 
            ? source 
            : source.value || source.textContent || "";

        if (!text.trim()) {
            alert(`No ${label} to copy`);
            return;
        }

        navigator.clipboard.writeText(text)
            .then(() => alert(`${label} copied to clipboard`))
            .catch(err => {
                console.error(`Failed to copy ${label}:`, err);
                alert(`Failed to copy ${label}. Please try again.`);
            });
    }

    clearText(target, label, setter = null) {
        if (confirm(`Clear ${label}?`)) {
            if (setter) {
                setter("");
            } else if (typeof target === "string") {
                document.getElementById(target).value = "";
            } else if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
                target.value = "";
            }
        }
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
        const cpuState = cpu ? {
            head_position: cpu.head_position,
            current_state: cpu.current_state,
            input_tape: cpu.input_tape,
            running: cpu.running,
            tape: cpu.tape
        } : {};

        return {
            name: this.gui.modelName,
            rulesText: this.getRulesText(),
            initial_tape: this.gui.initial_tape,
            rulesNo: this.gui.rulesNo,
            max_len: this.gui.max_len,
            tape_len: this.gui.tape_len,
            step_count: this.gui.step_count,
            LEFT, RIGHT, BLANK, INIT_STATE, HALT_STATE, COMMENT_PREFIX,
            MAX_STATES, MAX_TAPE_LEN, MAX_STATE_SIZE, TRANSITION_SIZE,
            history: this.gui.history,
            ...cpuState,
            buildGIF:  document.getElementById("buildGIF").disabled,
            stepBtn: document.getElementById("stepBtn").disabled,
            RunPauseBtn:  document.getElementById("RunPauseBtn").disabled,
            ControlBtn:  document.getElementById("ControlBtn").className,
        };
    }

    async loadJSON(file) {
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

    loadRules(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject("No file provided");
                return;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const text = e.target.result.trim();
                    resolve(text); // resolves with the file text
                } catch (error) {
                    reject(error);
                }
            };
            reader.onerror = reject;

            reader.readAsText(file);
        });
    }

    async loadYAML(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error("No file provided"));
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    // Reverse of dump() — parse YAML text into object
                    const state = jsyaml.load(e.target.result);

                    if (!state || typeof state !== "object") {
                        throw new Error("Invalid YAML format");
                    }

                    resolve(state); // Let caller decide how to handle it (e.g., this.loadState(state))
                } catch (error) {
                    console.error("Error parsing YAML:", error);
                    alert(`Error loading YAML file: ${error.message}`);
                    reject(error);
                }
            };

            reader.onerror = () => {
                reject(new Error("Error reading YAML file"));
            };

            reader.readAsText(file);
        });
    }

    exportFileData(format) {
        let file_data = "";
        switch (format) {
            case "txt":
                file_data = this.getRulesText();
                break;

            case "json":
                file_data = JSON.stringify(this.saveState(), null, 2);
                break;

            case "jsonl":
                const json_data = this.saveState();
                const { history, ...metadata } = json_data;
                const lines = [JSON.stringify(metadata)];
                if (history?.length) {
                    history.forEach(entry => lines.push(JSON.stringify(entry)));
                }
                file_data = lines.join("\n");
                break;

            case "yaml":
                file_data = jsyaml.dump(this.saveState());
                break;

            default:
                console.warn("Unknown export format selected");
        }
        return file_data;
    }

    downloadFile(file_data, file_type) {
        return new Promise((resolve, reject) => {
            let mimeType;
            switch (file_type) {
                case "json":
                    mimeType = "application/json";
                    break;
                case "jsonl":
                    mimeType = "application/x-ndjson"; // standard for JSON Lines
                    break;
                case "txt":
                    mimeType = "text/plain";
                    break;
                case "yaml":
                    mimeType = "text/yaml";
                    break;
                default:
                    reject(new Error(`Unsupported file type: ${file_type}`));
                    return;
            }

            const blob = new Blob([file_data], { type: mimeType });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = `${this.gui.modelName}.${file_type}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);

            URL.revokeObjectURL(url);
            resolve();
        });
    }

}

export {StateManager}