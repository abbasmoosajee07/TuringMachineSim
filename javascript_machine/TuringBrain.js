class TuringConfig {
    static LEFT = "L";
    static RIGHT = "R";
    static BLANK = "_";

    static INIT_STATE = "INIT";
    static HALT_STATE = "HALT";
    static COMMENT_PREFIX = "//";

    static MAX_STATES = 1024;
    static MAX_TAPE_LEN = 1048576;
    static MAX_STATE_SIZE = 32;
    static TRANSITION_SIZE = 710000;

    static getTimestamp() {
        return performance.now() / 1000;
    }

    static getCurrentMemoryMB() {
        return performance.memory ? (performance.memory.usedJSHeapSize / (1024 * 1024)).toFixed(2) : 'N/A';
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
}

class MachineLogic {
    constructor(
        transitionsList,
        initState = TuringConfig.INIT_STATE,
        haltState = TuringConfig.HALT_STATE,
        blankSymbol = TuringConfig.BLANK) {
        this.init_state = initState;
        this.halt_state = haltState;
        this.blank_symbol = blankSymbol;

        this.MAX_STATES = TuringConfig.MAX_STATES;
        this.MAX_STATE_SIZE = TuringConfig.MAX_STATE_SIZE;

        this.transitions_list = transitionsList;
        this.transitions_dict = this._buildTransitionDict(transitionsList, initState, haltState);

        // Initialize Tape
        this.head_position = 0;
        this.current_state = initState;
        this.tape = {};
        this.running = true;
        this.input_tape = "";
    }

    _validateTransition(transition) {
        if (transition.length !== 5) {
            throw new Error(`Invalid transition: ${transition}. Expected 5 elements: (currentState, currentSymbol, newState, newSymbol, moveDirection).`);
        }

        const [current_state, current_symbol, new_state, new_symbol, direction] = transition;

        if (direction !== TuringConfig.LEFT && direction !== TuringConfig.RIGHT) {
            throw new Error(`Invalid move direction: '${direction}'. Must be 'L' or 'R'.`);
        }

        for (const [symbol, label] of [[current_symbol, "current"], [new_symbol, "new"]]) {
            if (symbol.length !== 1) {
                throw new Error(`Invalid ${label}_symbol: '${symbol}'. Must be a single character.`);
            }
        }

        for (const [state, label] of [[current_state, "current"], [new_state, "new"]]) {
            if (state.length > this.MAX_STATE_SIZE) {
                throw new Error(`Invalid ${label}_state: ${state} size=${state.length}. State Size must be less than ${this.MAX_STATE_SIZE} characters.`);
            }
        }

        return transition;
    }

    _buildTransitionDict(transitionsList, initState, haltState) {
        const transitionDict = {};
        let hasHaltState = false;

        for (const transition of transitionsList) {
            const [currentState, currentSymbol, newState, newSymbol, moveDirection] = this._validateTransition(transition);

            if (!transitionDict[currentState]) {
                transitionDict[currentState] = {};
            }

            if (currentSymbol in transitionDict[currentState]) {
                throw new Error(`Duplicate transition for state ${currentState} and symbol ${currentSymbol}`);
            }

            transitionDict[currentState][currentSymbol] = [newState, newSymbol, moveDirection];

            if (newState === haltState) {
                hasHaltState = true;
            }
        }

        if (Object.keys(transitionDict).length > this.MAX_STATES) {
            throw new Error(`Too many states: ${Object.keys(transitionDict).length}. Maximum is ${this.MAX_STATES}.`);
        }

        if (!transitionDict[initState]) {
            throw new Error(`Initial state ${initState} not found in the transitions`);
        }

        if (!hasHaltState) {
            throw new Error(`Halt state ${haltState} not found in the transitions`);
        }

        return transitionDict;
    }

    _setTape(inputTape) {
        if (inputTape.includes(" ")) {
            throw new Error("Input tape must not contain spaces");
        }

        this.head_position = 0;
        this.current_state = this.init_state;
        this.tape = {};
        this.input_tape = inputTape;

        for (let i = 0; i < inputTape.length; i++) {
            const symbol = inputTape[i];
            if (symbol !== this.blank_symbol) {
                this.tape[i] = symbol;
            }
        }
    }

    _getTapeBoundaries(windowSize = 5) {
        const positions = Object.keys(this.tape).map(Number);
        let minPos = positions.length > 0 ? Math.min(...positions) : this.head_position - windowSize;
        let maxPos = positions.length > 0 ? Math.max(...positions) : this.head_position + windowSize;

        minPos = Math.min(minPos, this.head_position) - windowSize;
        maxPos = Math.max(maxPos, this.head_position) + windowSize;
        return [minPos, maxPos];
    }

    _printTapeState(visualize = true) {
        const [minPos, maxPos] = this._getTapeBoundaries();
        const headPosInWindow = this.head_position - minPos;

        let tapeStr = "";
        for (let i = minPos; i <= maxPos; i++) {
            tapeStr += this.tape[i] ?? this.blank_symbol;
        }

        const pointerStr = `${" ".repeat(headPosInWindow)}^`;
        const tape_state = `[${this.stepCount}]: ${this.current_state}`
        const printedState = [tapeStr, pointerStr, tape_state, ""];

        if (visualize) {
            console.log(printedState.join("\n"));
        }

        return tapeStr.replace(new RegExp(`^${this.blank_symbol}+|${this.blank_symbol}+$`, 'g'), '');
    }

    _stepLogic() {
        const stateTransitions = this.transitions_dict[this.current_state];
        if (!stateTransitions) {
            throw new Error(`No transitions for state ${this.current_state} with input tape ${this.input_tape}`);
        }

        const currentSymbol = this.tape[this.head_position] ?? this.blank_symbol;
        const transition = stateTransitions[currentSymbol];
        if (!transition) {
            throw new Error(`No transition for symbol '${currentSymbol}' in state ${this.current_state} with input tape ${this.input_tape}`);
        }

        const [newState, newSymbol, moveDirection] = transition;

        if (newSymbol === this.blank_symbol) {
            delete this.tape[this.head_position];
        } else {
            this.tape[this.head_position] = newSymbol;
        }

        const shift = moveDirection === TuringConfig.LEFT ? -1 : 1;
        this.current_state = newState;
        this.head_position += shift;
    }

    runLogic(inputTape, maxSteps = 1_000_000, visualize = false) {
        this.input_tape = inputTape;
        this._setTape(inputTape);
        this._printTapeState(visualize);

        this.stepCount = 0;
        let tape = "";
        while (this.running && this.stepCount < maxSteps) {
            if (this.current_state === this.halt_state) {
                this.running = false;
                if (visualize) {
                    console.log(`HALTED after ${this.stepCount} steps`);
                }
                continue;
            }

            this._stepLogic();
            tape = this._printTapeState(visualize);
            this.stepCount++;
        }

        return [tape, this.stepCount, this.transitions_list.length];
    }

    async runIncrementally(inputTape, visualize = true, maxSteps = 1_000_000) {
        console.log("Turing Machine Initialized:");
        console.log("Enter [space] to step, number to step n times, or q to quit:\n")
        this.stepCount = 0;
        let tape = "";

        this.input_tape = inputTape;
        this._setTape(inputTape);
        this._printTapeState(visualize);

        while (this.running && this.stepCount < maxSteps) {
            if (this.current_state === this.halt_state) {
                this.running = false;
                if (visualize) {
                    console.log(`HALTED after ${this.stepCount} steps`);
                }
                break;
            }
            const key = await new Promise(resolve => {
                process.stdin.resume();
                process.stdin.setEncoding('utf8');
                process.stdin.once('data', data => resolve(data.trim()));
            });

            if (key === 'q') {
                console.log("Machine Stopped Manually");
                break;
            } else if (key === '' || key === ' ') {
                this._stepLogic();
                this.stepCount++;
                tape = this._printTapeState(visualize);
            } else if (/^\d+$/.test(key)) {
                const stepsToRun = parseInt(key, 10);
                for (let i = 0; i < stepsToRun; i++) {
                    if (this.current_state === this.halt_state || !this.running) break;
                    this._stepLogic();
                    this.stepCount++;
                    tape = this._printTapeState(visualize);
                }
            } else {
                console.log(`Unrecognized key: '${key}'`);
            }
        }

        return [tape, this.stepCount, this.transitions_list.length];
    }

}

export { TuringConfig, MachineLogic };
