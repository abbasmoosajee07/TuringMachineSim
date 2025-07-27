class MachineLogic {
    constructor(transitionsList, initState = "INIT", haltState = "HALT", blankSymbol = TuringConfig.BLANK) {
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

    _getTapeBoundaries(windowSize = 10) {
        const positions = Object.keys(this.tape).map(Number);
        let minPos = positions.length > 0 ? Math.min(...positions) : this.head_position - windowSize;
        let maxPos = positions.length > 0 ? Math.max(...positions) : this.head_position + windowSize;

        minPos = Math.min(minPos, this.head_position - windowSize);
        maxPos = Math.max(maxPos, this.head_position + windowSize);
        return [minPos, maxPos];
    }

    _printTapeState(visualize = true) {
        const [minPos, maxPos] = this._getTapeBoundaries();
        let tapeStr = "";

        for (let i = minPos; i <= maxPos; i++) {
            tapeStr += this.tape[i] !== undefined ? this.tape[i] : this.blank_symbol;
        }

        if (visualize) {
            // In the GUI, we'll update the display directly
        }

        // Return just the non-blank portion of the tape
        return tapeStr.replace(new RegExp(`^${this.blank_symbol}+|${this.blank_symbol}+$`, 'g'), '');
    }

    _stepLogic() {
        const stateTransitions = this.transitions_dict[this.current_state];
        if (!stateTransitions) {
            throw new Error(`No transitions for state ${this.current_state} with input tape ${this.input_tape}`);
        }

        const currentSymbol = this.tape[this.head_position] !== undefined ? this.tape[this.head_position] : this.blank_symbol;
        const transition = stateTransitions[currentSymbol];
        if (!transition) {
            throw new Error(`No transition for symbol '${currentSymbol}' in state ${this.current_state} with input tape ${this.input_tape}`);
        }

        const [newState, newSymbol, moveDirection] = transition;

        // Write new symbol to tape
        if (newSymbol === this.blank_symbol) {
            delete this.tape[this.head_position];
        } else {
            this.tape[this.head_position] = newSymbol;
        }

        // Move head
        const shift = moveDirection === TuringConfig.LEFT ? -1 : 1;
        this.current_state = newState;
        this.head_position += shift;
    }

    runLogic(inputTape, maxSteps = 1000000, visualize = false) {
        this._setTape(inputTape);
        this._printTapeState(visualize);

        let stepCount = 0;
        while (this.running && stepCount < maxSteps) {
            if (this.current_state === this.halt_state) {
                this.running = false;
                if (visualize) {
                    console.log(`HALTED after ${stepCount} steps`);
                }
                continue;
            }

            this._stepLogic();
            const tape = this._printTapeState(visualize);
            stepCount++;
        }

        return [tape, stepCount, this.transitions_list.length];
    }

    runStep(inputTape, maxSteps = 1000000) {
        this._setTape(inputTape);
        this._printTapeState(true);

        if (this.current_state === this.halt_state) {
            return [this._printTapeState(false), 0, this.transitions_list.length];
        }

        this._stepLogic();
        const tape = this._printTapeState(true);
        return [tape, 1, this.transitions_list.length];
    }

    runMultipleSteps(steps, maxSteps = 1000000) {
        let stepCount = 0;
        let tape = "";

        while (this.running && stepCount < steps && stepCount < maxSteps) {
            if (this.current_state === this.halt_state) {
                this.running = false;
                break;
            }

            this._stepLogic();
            tape = this._printTapeState(true);
            stepCount++;
        }

        return [tape, stepCount, this.transitions_list.length];
    }
}