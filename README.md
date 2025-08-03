Here’s your updated README with a **"Future Features"** section added as a table:

---

# Turing Machine Simulator

A web-based simulator for deterministic Turing Machines that allows you to define transition rules, run the machine step-by-step or automatically, and visualize the tape and machine state in real-time.

[Click here to start](https://abbasmoosajee07.github.io/TuringMachineSim/)

## Features

- **Interactive GUI**: Visualize the tape, head position, and current state
- **Multiple Run Modes**: 
  - Single-step execution
  - Continuous run with adjustable speed
  - Full execution with results summary
- **History Navigation**: Slider to review previous states
- **Resource Monitoring**: Tracks steps, time, and memory usage
- **Error Handling**: Clear error messages for invalid configurations
- **Responsive Design**: Works on both desktop and mobile devices

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Edge, Safari)
- Python 3.x (for local development server)

### Installation & Running
1. **Using Local Web Server**:
   ```bash
   # Clone or download the project
   git clone https://github.com/your-repo/TuringMachineSim.git
   cd TuringMachineSim

   # Start a simple HTTP server
   python -m http.server
   ````
Then open `http://localhost:8000` in your browser.

2. **Direct File Access**:

   * Simply open the `TuringHTML.html` file in your browser (note: this single-file version might be slightly outdated)

## Using the Simulator

### Basic Controls

* **Load**: Initialize the machine with current rules and tape
* **Step**: Execute one transition
* **Run**: Continuous execution
* **Pause**: Stop continuous execution
* **Reset**: Return to initial configuration
* **History Slider**: Navigate through previous states

### Input Format

1. **Transition Rules**:

   ```
   currentState currentSymbol newState newSymbol direction
   ```

   Example:

   ```
   INIT 0 HALT 1 R
   INIT 1 INIT 0 R
   ```

2. **Initial Tape**:

   * Enter symbols without spaces (e.g., "0101")
   * Blank symbols are automatically filled with `_`

## Documentation

### Key Components

* **BasicRunner.js**: Core machine execution logic
* **Simulator\_GUI.js**: Interactive interface implementation
* **TuringBrain.js**: Core Turing Machine logic and configuration

### Advanced Features

* Adjustable step delay (speed control)
* Maximum step limit configuration
* Tape visualization with highlighted head position
* State transition history tracking

## Dependencies

* [Ace](https://ace.c9.io/) Code Editor for formatting
* [Bootstrap](https://getbootstrap.com/) for Icons and UI Styling

## 🚀 Future Features

| Feature                   | Description                                            |
| ------------------------- | ------------------------------------------------------ |
| Tape GIF     | Create a Tape GIF showing the transformation     |
| Export/Import Config      | Save/load machine rules and tape setup in JSON format  |
| Tape Scrolling Buttons    | Navigate long tapes easily with arrows                 |
| Web Export                | Generate shareable URL or embed for configured machine |
| Dark Mode Toggle          | Switch to a dark-themed UI for accessibility           |
| Run Summary Modal         | Display stats and final tape state after halting       |
| Rule Syntax Validator     | Highlight and report malformed rules             |

##### Planned Machine Types

| Possible Variations | Description |
|--------------|-------------|
| **Non-deterministic Machine** | Allows multiple possible transitions for the same `(state, symbol)` pair. At each step, one rule is selected at random, simulating non-deterministic computation. Useful for exploring theoretical concepts like NP problems. |
| **Multi-Tape Machine** | Uses multiple independent tapes, each with its own read/write head. Transitions can read/write on all tapes simultaneously. Often used to model more efficient machines. |
| **Semi-Infinite Machine** | A machine whose tape is infinite in one direction only (usually to the right), with a fixed left boundary. Reflects physical memory constraints more realistically. |
| **Enumerator Machine** | A Turing machine equipped with a write-only output tape, used to generate formal languages. Accepts a language by enumerating its strings. Equivalent in power to Turing machines but models generation instead of recognition. |
| **Multi-Head Machine** | Has multiple heads on a single tape, each able to read/write independently. Allows more complex behaviors and parallel scanning. |
| **Multi-Track Machine** | The tape is composed of multiple parallel tracks at each cell (like a vector), with each head reading/writing all tracks at once. Useful for modeling complex data per cell. |
| **K-Dimensional Machine** | Generalizes the tape from 1D to a 2D or higher-dimensional grid. The head can move in multiple directions (up, down, left, right, etc.), useful for spatial computation models. |


---
