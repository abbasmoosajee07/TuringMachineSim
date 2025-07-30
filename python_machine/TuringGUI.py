import tkinter as tk
from tkinter import ttk, messagebox
from TuringMachine import MachineLogic, TuringConfig, TuringMachine
import ctypes, platform

class TuringGUI:
    def __init__(self, transition_rules_str: str | None = None):
        if not transition_rules_str:
            transition_rules_str = """INIT | FIND | R\nFIND | FIND | R\nFIND _ HALT | R"""

        self.set_dpi_awareness()
        self.root = tk.Tk()
        self.root.title("Turing Machine Simulator")
        self.root.resizable(False, False)

        self.init_rules = transition_rules_str
        self.turing = TuringMachine(transition_rules_str)
        self.cpu = MachineLogic(self.turing.transition_rules)

        self.MAX_STEPS = 1_000_000
        self.BASE_STEP = 1
        self.DELAY = 300

        self.init_time = TuringConfig.get_timestamp()
        self.init_memory = TuringConfig.get_current_memory_mb()
        self.history = []

    @staticmethod
    def set_dpi_awareness():
        if platform.system() == "Windows":
            try:
                ctypes.windll.shcore.SetProcessDpiAwareness(1)
            except AttributeError:
                try:
                    ctypes.windll.user32.SetProcessDPIAware()
                except Exception:
                    pass
            except Exception:
                pass

    def _build_gui(self):
        self.main = ttk.Frame(self.root, padding=10)
        self.main.grid(row=0, column=0, sticky="nsew")
        self.root.columnconfigure(0, weight=1)
        self.root.rowconfigure(0, weight=1)
        style = ttk.Style()
        style.configure("Bold.TLabelframe.Label", font=("Helvetica", 10, "bold"))

        ttk.Label(self.main, text="Turing Machine Simulator", font=("Helvetica", 20, "bold")).grid(column=0, columnspan=2, pady=10)

        tape_card = ttk.LabelFrame(self.main, text="Tape", padding=10, style="Bold.TLabelframe")
        tape_card.grid(row=1, column=0, columnspan=2, sticky="nsew", padx=10, pady=5)

        self.tape_canvas = tk.Canvas(tape_card, height=40)
        self.tape_scroll = ttk.Scrollbar(tape_card, orient="horizontal", command=self.tape_canvas.xview)
        self.tape_canvas.configure(xscrollcommand=self.tape_scroll.set)

        self.tape_frame = ttk.Frame(self.tape_canvas)
        self.tape_canvas_window = self.tape_canvas.create_window((0, 0), window=self.tape_frame, anchor="nw")

        self.tape_frame.bind("<Configure>", lambda e: self.tape_canvas.configure(scrollregion=self.tape_canvas.bbox("all")))
        self.tape_canvas.pack(fill="x", expand=True)
        self.tape_scroll.pack(fill="x")

        self.tape_cells = {}

        self.status_label = ttk.Label(tape_card, text="State: INIT | Step: 0", font=("Helvetica", 12))
        self.status_label.pack()
        self.halt_label = tk.Label(tape_card, text="", fg="red", font=("Helvetica", 12, "bold"))
        self.halt_label.pack()

        self.history_slider = ttk.Scale(tape_card, from_=0, to=0, orient="horizontal", command=self.__seek_history)
        self.history_slider.pack(fill="x", padx=5, pady=5)

        config_frame = ttk.LabelFrame(self.main, text="Configure Model", padding=10, style="Bold.TLabelframe")
        config_frame.grid(row=3, column=0, sticky="nsew", padx=10, pady=10)

        parsed_rules = "\n".join(line.lstrip() for line in self.init_rules.strip().splitlines())
        ttk.Label(config_frame, text="Transition Rules:").grid(row=0, column=0, sticky="w")
        self.rules_no = ttk.Label(config_frame, text="", font=("Courier", 10), foreground="green")
        # self.rules_no.grid(row=0, column=0, sticky="w", padx=115, pady=5)

        rules_frame = ttk.Frame(config_frame)
        rules_frame.grid(row=1, column=0, pady=5, sticky="nsew")
        rules_frame.grid_rowconfigure(0, weight=0)  # Don't expand height

        # Line numbers
        self.rules_linenumbers = tk.Text(
            rules_frame, width=4, height=7, padx=4, takefocus=0, border=0,
            background="#f0f0f0", state="disabled", wrap="none",
            font=("Courier", 10), fg="gray"
        )
        self.rules_linenumbers.grid(row=0, column=0, sticky="n")  # no vertical stretching

        # Main text
        self.rules_text = tk.Text(rules_frame, height=7, width=40, wrap="none", font=("Courier", 10))
        self.rules_text.grid(row=0, column=1, sticky="nsew")

        # --- Scrollbars ---
        rules_scroll_y = ttk.Scrollbar(rules_frame, orient="vertical", command=self._on_scroll)
        rules_scroll_y.grid(row=0, column=2, sticky="ns")

        rules_scroll_x = ttk.Scrollbar(rules_frame, orient="horizontal", command=self.rules_text.xview)
        rules_scroll_x.grid(row=1, column=1, sticky="ew")

        self.rules_text.configure(
            yscrollcommand=lambda *args: (rules_scroll_y.set(*args), self._sync_scroll()),
            xscrollcommand=rules_scroll_x.set
        )

        # --- Bind events ---
        self.rules_text.bind("<<Modified>>", lambda e: self._on_text_modified())
        self.rules_text.bind("<MouseWheel>", lambda e: self._sync_scroll())
        self.rules_text.bind("<KeyRelease>", lambda e: self._on_text_modified())
        self.rules_text.bind("<ButtonRelease-1>", lambda e: self._on_text_modified())

        # --- Insert rules and initialize ---
        self.rules_text.insert("1.0", parsed_rules)
        self._update_linenumbers()

        ttk.Label(config_frame, text="Initial Tape:").grid(row=2, column=0, sticky="w")
        self.tape_input = ttk.Entry(config_frame, width=50)
        self.tape_input.insert(0, self.initial_tape)
        self.tape_input.grid(row=3, column=0, pady=5)

        button_frame = ttk.Frame(config_frame)
        button_frame.grid(row=4, column=0, pady=5)
        ttk.Button(button_frame, text="Load Model", command=self.__load).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Reset Model", command=self.__hard_reset).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Copy Rules", command=self.__copy_rules).pack(side="left", padx=5)
        ttk.Button(button_frame, text="Clear Rules", command=self.__clear_rules).pack(side="left", padx=5)

        right_frame = ttk.Frame(self.main)
        right_frame.grid(row=3, column=1, sticky="nsew", padx=10, pady=10)

        control_frame = ttk.LabelFrame(right_frame, text="Control Machine", padding=10, style="Bold.TLabelframe")
        control_frame.pack(fill="both", expand=True)

        # --- Row 0: Go to Step ---
        goto_inner = ttk.Frame(control_frame)
        goto_inner.grid(row=0, column=0, columnspan=2, sticky="w", pady=(0, 10))

        ttk.Label(goto_inner, text="Step No:").pack(side="left", padx=(0, 5))
        self.goto_entry = ttk.Entry(goto_inner, width=6)
        self.goto_entry.pack(side="left")
        ttk.Button(goto_inner, text="Go", command=self.__go_to_step).pack(side="left", padx=(5, 0))

        # --- Row 1: Step Info ---
        self.step_info_frame = ttk.Frame(control_frame)
        self.step_info_frame.grid(row=1, column=0, columnspan=2, sticky="ew", pady=(0, 10))

        step_state_frame = ttk.Frame(self.step_info_frame)
        step_state_frame.pack(fill="x", pady=5)

        label_row = ttk.Frame(step_state_frame)
        label_row.pack(fill="x")

        ttk.Label(label_row, text="Step State:").pack(side="left")

        self.step_index = ttk.Label(label_row, text="", font=("Courier", 10), foreground="blue")
        self.step_index.pack(side="left", padx=5)

        self.step_state = ttk.Label(step_state_frame, text="", font=("Courier", 11), anchor="center", justify="center")
        self.step_state.pack(fill="x", pady=2)

        # --- Row 2-4: Entry Inputs ---
        ttk.Label(control_frame, text="Steps:").grid(row=2, column=0, sticky="w")
        self.step_entry = ttk.Entry(control_frame, width=10)
        self.step_entry.insert(0, str(self.BASE_STEP))
        self.step_entry.grid(row=2, column=1, sticky="w", padx=5, pady=2)

        ttk.Label(control_frame, text="Max Steps:").grid(row=3, column=0, sticky="w")
        self.max_steps = ttk.Entry(control_frame, width=10)
        self.max_steps.insert(0, str(self.MAX_STEPS))
        self.max_steps.grid(row=3, column=1, sticky="w", padx=5, pady=2)

        ttk.Label(control_frame, text="Speed (ms):").grid(row=4, column=0, sticky="w")
        self.delay_entry = ttk.Entry(control_frame, width=10)
        self.delay_entry.insert(0, str(self.DELAY))
        self.delay_entry.grid(row=4, column=1, sticky="w", padx=5, pady=5)

        # --- Row 5: Buttons ---
        btn_frame = ttk.Frame(control_frame)
        btn_frame.grid(row=5, column=0, columnspan=2, pady=5)

        ttk.Button(btn_frame, text="Step", command=self.__step).grid(row=0, column=0, padx=4)
        self.run_button = ttk.Button(btn_frame, text="Run", command=self.__run)
        self.run_button.grid(row=0, column=1, padx=4)
        self.pause_button = ttk.Button(btn_frame, text="Pause", command=self.__pause, state="disabled")
        self.pause_button.grid(row=0, column=2, padx=4)

        # Info Help Button (top-right corner)
        info_btn = ttk.Button(self.root, text="?", width=3, command=self.__show_info)
        info_btn.place(relx=1.0, rely=0.0, anchor="ne", x=-20, y=20)

    def _on_text_modified(self):
        self.rules_text.tk.call(self.rules_text._w, 'edit', 'modified', 0)
        self._update_linenumbers()

    def _on_scroll(self, *args):
        self.rules_text.yview(*args)
        self._sync_scroll()

    def _sync_scroll(self):
        """Scroll the line number area to match the main text widget."""
        self.rules_linenumbers.yview_moveto(self.rules_text.yview()[0])

    def _update_linenumbers(self):
        self.rules_text.edit_modified(False)
        line_count = int(self.rules_text.index("end-1c").split('.')[0])
        line_numbers = "\n".join(str(i) for i in range(1, line_count + 1))

        # Dynamically adjust width based on digits
        width = max(2, len(str(line_count)))
        self.rules_linenumbers.config(width=width)

        self.rules_linenumbers.configure(state="normal")
        self.rules_linenumbers.delete("1.0", "end")
        self.rules_linenumbers.insert("1.0", line_numbers)
        self.rules_linenumbers.configure(state="disabled")

    def __show_info(self):
        info_window = tk.Toplevel(self.root)
        info_window.title("Turing Machine Help")
        info_window.resizable(False, False)

        # Optional: place window near top-right
        info_window.geometry("+{}+{}".format(self.root.winfo_x() + 100, self.root.winfo_y() + 100))

        # Text widget inside a frame with scroll
        frame = ttk.Frame(info_window, padding=10)
        frame.pack(fill="both", expand=True)

        text = tk.Text(frame, wrap="word", height=25, width=70, font=("Courier New", 10))
        scrollbar = ttk.Scrollbar(frame, command=text.yview)
        text.configure(yscrollcommand=scrollbar.set)

        text.grid(row=0, column=0, sticky="nsew")
        # scrollbar.grid(row=0, column=1, sticky="ns")

        frame.rowconfigure(0, weight=1)
        frame.columnconfigure(0, weight=1)

        # Insert the help message
        message = (
            "🧠 Turing Machine Simulator Help\n\n"
            "This simulator visualizes the execution of a deterministic Turing Machine.\n"
            "You can define custom rules, input tape values, and run the machine step-by-step or continuously.\n\n"

            "📘 TRANSITION RULE FORMAT:\n"
            "  currentState  currentSymbol  newState  newSymbol  moveDirection\n"
            "  Example:  INIT | FIND | R\n\n"

            "🔧 MACHINE BASICS:\n"
            f"  • Initial State      : 'INIT'\n"
            f"  • Halt State         : 'HALT'\n"
            f"  • Move Directions    : '{TuringConfig.LEFT}' (left), '{TuringConfig.RIGHT}' (right)\n"
            f"  • Blank Symbol       : '{TuringConfig.BLANK}'\n"
            f"  • Comment Prefix     : '{TuringConfig.COMMENT_PREFIX}'\n\n"

            "🚦 MACHINE LIMITS:\n"
            f"  • MAX_STATES         = {TuringConfig.MAX_STATES}\n"
            f"  • MAX_TAPE_LEN       = {TuringConfig.MAX_TAPE_LEN}\n"
            f"  • MAX_STATE_SIZE     = {TuringConfig.MAX_STATE_SIZE}\n"
            f"  • TRANSITION_SIZE    = {TuringConfig.TRANSITION_SIZE}\n"
        )
        text.insert("1.0", message)
        text.config(state="disabled")

    def __go_to_step(self):
        try:
            step = int(self.goto_entry.get())
        except ValueError:
            messagebox.showerror("Invalid Input", "Please enter a valid step number.")
            return

        if 0 <= step <= self.step_count:
            self.history_slider.set(step)
            self.__seek_history(step)

            # Prev Step
            prev = self.history[step - 1]["state"] if step > 0 else "--"

            # Next Step
            if step + 1 < len(self.history):
                next_state = self.history[step + 1]["state"]
            else:
                next_state = "--"
            current = self.history[step]["state"]

            full_state = f"{prev} <- {current} -> {next_state}"
            self.step_index.config(text=f"[{step}]")
            self.step_state.config(text=full_state)

        else:
            messagebox.showwarning("Out of Range", f"Step must be between 0 and {self.step_count}")

    def __seek_history(self, val):
        index = int(float(val))
        if index == self.step_count:
            self.__draw_tape(self.cpu.tape, self.cpu.head_position, self.cpu.current_state, index)
        elif 0 <= index < len(self.history):
            state = self.history[index]
            self.__draw_tape(state["tape"], state["head"], state["state"], index, highlight=True)

    def __step(self):
        try:
            steps_to_run = int(self.step_entry.get())
        except ValueError:
            steps_to_run = self.BASE_STEP

        try:
            max_allowed = int(self.max_steps.get())
        except ValueError:
            max_allowed = self.MAX_STEPS

        for _ in range(steps_to_run):
            self.history.append({
                "tape": self.cpu.tape.copy(),
                "head": self.cpu.head_position,
                "state": self.cpu.current_state
            })
            if self.step_count >= max_allowed:
                self.halt_label.config(text=f"Max steps ({max_allowed}) reached")
                self.__pause()
                break

            if self.cpu.current_state == self.cpu.halt_state:
                self.halt_label.config(text=f"Machine HALTED | Total Steps: {self.step_count}", foreground="green")
                self.__pause()
                break

            try:
                self.cpu._step_logic()
                self.step_count += 1
            except TuringConfig.MissingTransitionError as e:
                messagebox.showerror("Transition Error", str(e))
                self.halt_label.config(text=f"Machine STUCK | After {self.step_count} Steps", foreground="red")
                self.__pause()
                break

        self.history_slider.config(to=self.step_count)
        self.history_slider.set(self.step_count)
        self.__update_display()

    def __auto_step(self):
        if not self.running:
            return
        self.__step()
        try:
            delay = int(self.delay_entry.get())
        except ValueError:
            delay = self.DELAY
        self.root.after(delay, self.__auto_step)

    def __update_display(self):
        self.__draw_tape(self.cpu.tape, self.cpu.head_position, self.cpu.current_state, self.step_count)

    def __draw_tape(self, tape_dict, head_pos, current_state, step_num, highlight=True):
        for widget in self.tape_frame.winfo_children():
            widget.destroy()
        self.tape_cells.clear()

        min_index = min(tape_dict.keys(), default=0)
        max_index = max(tape_dict.keys(), default=0)
        start = min(min_index, head_pos) - 7
        end = max(max_index, head_pos) + 7

        for i in range(start, end + 1):
            symbol = tape_dict.get(i, self.cpu.blank_symbol)
            lbl = tk.Label(self.tape_frame, text=symbol, width=2, height=1, font=("Courier", 16),
                            relief="solid", borderwidth=0.2, bg="white")
            if i == head_pos and highlight:
                lbl.config(highlightbackground="blue", highlightcolor="blue",
                            highlightthickness=2, font=("Courier", 16, "bold"))
            lbl.grid(row=0, column=i - start, padx=2)
            self.tape_cells[i] = lbl

        self.tape_frame.update_idletasks()
        self.tape_canvas.configure(scrollregion=self.tape_canvas.bbox("all"))

        if head_pos in self.tape_cells:
            cell_width = self.tape_cells[head_pos].winfo_width()
            total_width = (end - start + 1) * (cell_width + 4)
            canvas_width = self.tape_canvas.winfo_width()
            scroll_to = max((head_pos - start) * (cell_width + 4) - canvas_width // 2, 0)
            self.tape_canvas.xview_moveto(scroll_to / total_width)

        self.status_label.config(text=f"State: {current_state} | Step: {step_num}")

    def __run(self):
        self.running = True
        self.run_button.config(state="disabled")
        self.pause_button.config(state="normal")
        self.__auto_step()

    def __pause(self):
        self.running = False
        self.run_button.config(state="normal")
        self.pause_button.config(state="disabled")

    def __load(self):
        rules = self.rules_text.get("1.0", "end-1c").strip()
        self.initial_tape = self.tape_input.get()
        self.turing = TuringMachine(rules)
        self.cpu = MachineLogic(self.turing.transition_rules)
        self.cpu._set_tape(self.initial_tape)
        self.cpu.input_tape = self.initial_tape
        self.step_count = 0
        self.running = False
        self.halt_label.config(text="")
        self.run_button.config(state="normal")
        self.pause_button.config(state="disabled")
        self.history = []
        self.history_slider.config(to=0)
        self.rules_no.config(text=f"[{self.cpu.rules_no}]")
        self.__update_display()

    def __hard_reset(self):
        self.cpu._set_tape(self.initial_tape)
        self.cpu.input_tape = self.initial_tape
        self.cpu.current_state = self.cpu.init_state
        self.step_count = 0
        self.running = False
        self.halt_label.config(text="")
        self.run_button.config(state="normal")
        self.pause_button.config(state="disabled")
        self.history = []
        self.history_slider.config(to=0)
        self.__update_display()

    def __copy_rules(self):
        rules = self.rules_text.get("1.0", "end-1c").strip()
        if rules:
            self.root.clipboard_clear()
            self.root.clipboard_append(rules)
            self.root.update()  # keeps clipboard contents even after app closes
            messagebox.showinfo("Copied", "Transition srules copied to clipboard.")
        else:
            messagebox.showwarning("Empty", "No rules to copy.")

    def __clear_rules(self):
        confirm = messagebox.askyesno("Clear Rules", "Are you sure you want to clear all transition rules?")
        if confirm:
            self.rules_text.delete("1.0", "end")

    def run_simulator(self, init_tape: str | None = None):
        transition_rules = self.turing.transition_rules.copy()
        self.initial_tape = init_tape if init_tape else "||||"
        self.step_count = 0
        self.running = False
        self.history = []
        self._build_gui()
        self.__load()

        self.root.mainloop()

        resources_used = [
            f"   Time run: {TuringConfig.get_timestamp() - self.init_time:.5f}s",
            f"Memory used: {TuringConfig.get_current_memory_mb()}MB"
        ]

        final_tape = self.cpu._print_tape_state(False)
        results = [
            f"Result Tape: '{final_tape}'",
            f"Steps Count: {self.step_count}",
            f"Total Rules: {len(transition_rules)}",
        ]

        return transition_rules, results, resources_used

if __name__ == "__main__":
    init_rules = """
        INIT | FIND _ R
        FIND | FIND | R
        FIND + HALT | R
        """

    init_tape = "||||+||"

    _, results, used_resources = TuringGUI(init_rules).run_simulator(init_tape)
