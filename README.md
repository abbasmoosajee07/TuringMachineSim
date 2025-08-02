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
   ```
   Then open `http://localhost:8000` in your browser.

2. **Direct File Access**:
   - Simply open the `TuringHTML.html` file in your browser (note: this single-file version might be slightly outdated)

## Using the Simulator

### Basic Controls
- **Load**: Initialize the machine with current rules and tape
- **Step**: Execute one transition
- **Run**: Continuous execution
- **Pause**: Stop continuous execution
- **Reset**: Return to initial configuration
- **History Slider**: Navigate through previous states

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
   - Enter symbols without spaces (e.g., "0101")
   - Blank symbols are automatically filled with `_`

## Documentation

### Key Components
- **BasicRunner.js**: Core machine execution logic
- **Simulator_GUI.js**: Interactive interface implementation
- **TuringBrain.js**: Core Turing Machine logic and configuration

### Advanced Features
- Adjustable step delay (speed control)
- Maximum step limit configuration
- Tape visualization with highlighted head position
- State transition history tracking

## Dependencies
- [Ace](https://ace.c9.io/) Code Editor for formatting
- [Bootstrap](https://getbootstrap.com/) for Icons and UI Styling
