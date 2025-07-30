import sys
from pathlib import Path

# Add the 'python_machine' directory to sys.path
base_dir = Path(__file__).resolve().parent
turing_path = base_dir / "python_machine"
sys.path.insert(0, str(turing_path))

# Import Turing Machine components
from python_machine.TuringMachine import TuringMachine, MachineLogic, TuringConfig
from python_machine.TuringGUI import TuringGUI

# Re-export if used as a module
__all__ = ["TuringMachine", "MachineLogic", "TuringConfig", "TuringGUI"]

if __name__ == "__main__":
    init_rules = """
        INIT | FIND | R
        FIND | FIND | R
        FIND _ HALT | R
    """.strip()

    init_tape = ""

    # Run headless machine (console-only)
    _, basic_results, basic_resources = TuringMachine(init_rules).run_machine(
        init_tape, play_type=0, visualize=True
    )
    print("\n".join(basic_results + [""] + basic_resources))

    # Run GUI simulator
    _, gui_results, gui_resources = TuringGUI(init_rules).run_simulator(init_tape)
    print("\n".join(gui_results + [""] + gui_resources))
