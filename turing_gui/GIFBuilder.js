import { TuringConfig } from "../javascript_machine/TuringBrain.js";

class GIFBuilder {
    constructor(tapeDisplay, progressElement, gifName, rulesNo) {
        this.validateElements(tapeDisplay, progressElement, gifName);

        this.tapeDisplay = tapeDisplay;
        this.progressElement = progressElement;
        this.isBuilding = false;
        this.gif = null;
        this.gifName = gifName;
        this.rulesNo = rulesNo;
        this._initialTapeString = '';
        this.frameBgColor = "#ffffff";
        this.textColor = "#1b1b1b";

        this.initTempContainer();
    }

    validateElements(...elements) {
        elements.forEach(el => {
            if (!el) throw new Error('Required DOM elements not found');
        });
    }

    initTempContainer() {
        this.tempContainer = document.createElement('div');
        Object.assign(this.tempContainer.style, {
            position: 'fixed',
            left: '-9999px',
            top: '0',
            zIndex: '9999'
        });
        document.body.appendChild(this.tempContainer);
    }

    _initGIF() {
        this.CELL_WIDTH = 50;
        this.GIF_HEIGHT = 200;
        this.GIF_WIDTH = this.VISIBLE_CELLS * this.CELL_WIDTH;
        this.midpoint = Math.floor(this.VISIBLE_CELLS / 2) - 1;

        this.gif = new GIF({
            workers:  Math.min(navigator.hardwareConcurrency || 4, 8),
            quality: 10, // Increased quality (1-10)
            width: this.GIF_WIDTH * this.RESOLUTION_SCALE, // Render at higher resolution
            height: this.GIF_HEIGHT * this.RESOLUTION_SCALE, // Render at higher resolution
            workerScript: './pkg_backups/gif.worker.js',
            dither: false, // Disable dithering for sharper images
            transparent: null, // No transparency
            background: this.frameBgColor
        });
    }

    async buildFromHistory(history, seekCallback) {
        if (this.isBuilding) throw new Error("GIF generation already in progress");
        if (!Array.isArray(history) || history.length < 2) {
            throw new Error("Not enough history to generate GIF");
        }
        this.gifColor = document.getElementById('gifColor').value;
        this.VISIBLE_CELLS = ((parseInt(document.getElementById('visibleCells').value) || 15) | 1);
        this.RESOLUTION_SCALE = (parseInt(document.getElementById('resolution').value))

        this.isBuilding = true;
        this.setupUI();

        try {
            this._initGIF();
            await this._processFrames(history, seekCallback);
            return await this._finalizeGIF();
        } catch (error) {
            this.handleBuildError(error);
            throw error;
        }
    }

    setupUI() {
        this.progressElement.textContent = 'Preparing GIF...';
        document.getElementById('gifCard').style.display = 'block';
        this.setupSpeedControl();
    }

    setupSpeedControl() {
        const gifSpeedSlider = document.getElementById('gifSpeed');
        const gifSpeedLabel = document.getElementById('gifSpeedLabel');
        gifSpeedSlider.addEventListener('input', () => {
            gifSpeedLabel.textContent = gifSpeedSlider.value;
        });
    }

    async _processFrames(history, seekCallback) {
        const frameDelay = parseInt(document.getElementById('gifSpeed').value);
        const holdCount = 3;
        const lastIndex = history.length - 1;

        // Process hold frames
        await this.processHoldFrames(0, holdCount, history, seekCallback, frameDelay);

        // Process main frames
        await this.processMainFrames(history, seekCallback, frameDelay);

        // Process end hold frames
        await this.processHoldFrames(lastIndex, holdCount, history, seekCallback, frameDelay);
    }

    async processHoldFrames(frameIndex, count, history, seekCallback, frameDelay) {
        for (let j = 0; j < count; j++) {
            await this.processSingleFrame(
                frameIndex,
                history,
                frameDelay,
                seekCallback,
                this.updateProgress(count, history.length)
            );
        }
    }

    async processMainFrames(history, seekCallback, frameDelay) {
        const batchSize = Math.floor(history.length / 10);
        for (let i = 0; i < history.length; i++) {
            if (i % batchSize === 0) {
                this.updateProgress(i, history.length);
                await this.yieldToUI();
            }
            await this.processSingleFrame(i, history, frameDelay, seekCallback);
        }
    }

    async processSingleFrame(frameIndex, history, frameDelay, seekCallback, progressText = '') {
        if (!this.isBuilding) throw new Error("GIF generation cancelled");
        if (progressText) this.progressElement.textContent = progressText;

        seekCallback(frameIndex);
        const frame = this._renderFrame(history[frameIndex], frameIndex);

        this.tempContainer.innerHTML = '';
        this.tempContainer.appendChild(frame);
        await this.yieldToUI(20);

        const canvas = await this.captureFrame(frame);
        this.gif.addFrame(canvas, { delay: frameDelay, copy: true });
    }

    async captureFrame(frame) {
        return await html2canvas(frame, {
            backgroundColor: this.frameBgColor,
            scale: this.RESOLUTION_SCALE, // Render at higher resolution
            useCORS: true,
            allowTaint: true,
            width: this.GIF_WIDTH,
            height: this.GIF_HEIGHT,
            windowWidth: this.GIF_WIDTH,
            windowHeight: this.GIF_HEIGHT,
            logging: false,
            imageTimeout: 0,
            letterRendering: true, // Better text rendering
            ignoreElements: (element) => false

        });
    }

    updateProgress(current, total) {
        const percent = Math.round(((current + 1) / total) * 100);
        this.progressElement.textContent = `Processed ${percent}% of Steps`;
    }

    async yieldToUI(delay = 0) {
        await new Promise(resolve => setTimeout(resolve, delay));
    }

    _renderFrame(stateSnapshot, stepIndex) {
        const { head, tape, state, move: headMove } = stateSnapshot;
        const container = this.createFrameContainer();

        // Add GIF Header
        container.appendChild(this.createHeader());

        // Add tape display
        container.appendChild(this.createTapeDisplay(head, tape));

        // Add status display
        container.appendChild(this.createStatusDisplay(stepIndex, state, headMove, head));

        // Add tape summary
        if (stepIndex === 0) this._initialTapeString = this._tapeToString(tape);
        container.appendChild(this.createTapeSummary(tape));

        return container;
    }

    createFrameContainer() {
        const container = document.createElement('div');
        Object.assign(container.style, {
            position: 'relative',
            width: `${this.GIF_WIDTH}px`, // Original display size
            height: `${this.GIF_HEIGHT}px`, // Original display size
            backgroundColor: this.frameBgColor,
            padding: '20px',
            boxSizing: 'border-box',
            fontFamily: 'monospace',
            color: '#333',
            fontSize: '14px', // Original font size
            lineHeight: '20px' // Original line height
        });
        return container;
    }

    createHeader() {
        const header = document.createElement('div');
        Object.assign(header.style, {
            position: 'absolute',
            top: '1px',
            left: '20px',
            right: '20px',
            height: '28px',
            backgroundColor: this.frameBgColor,
            color: this.textColor,
            fontSize: '12px',
            fontFamily: 'monospace',
            padding: '4px 6px',
            boxSizing: 'border-box',
            zIndex: 10,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
        });

        const modelName = this.gifName || 'Unnamed';
        const ruleCount = this.rulesNo ?? 0;

        const left = document.createElement('span');
        left.textContent = `Rules: ${ruleCount}`;

        const right = document.createElement('span');
        right.textContent = `${modelName}`;
        right.style.fontStyle = "italic";

        header.appendChild(left);
        header.appendChild(right);

        return header;
    }

    createTapeDisplay(head, tape) {
        const tapeWrapper = document.createElement('div');
        tapeWrapper.className = 'tape-wrapper';
        Object.assign(tapeWrapper.style, {
            paddingTop: '8px',
            paddingBottom: '1px',
        });


        const tapeContainer = document.createElement('div');
        tapeContainer.className = 'tape-container';

        for (let i = head - this.midpoint; i < head + this.midpoint + 2; i++) {
            const cell = document.createElement('div');
            cell.className = 'tape-cell' + (i === head ? ' active' : '');
            cell.textContent = tape[i] ?? TuringConfig.BLANK;

            tapeContainer.appendChild(cell);
        }

        tapeWrapper.appendChild(tapeContainer);
        return tapeWrapper;
    }

    createStatusDisplay(stepIndex, state, headMove, head) {
        const statusContainer = document.createElement('div');
        Object.assign(statusContainer.style, {
            position: 'absolute',
            top: '95px', // Original position
            left: `${(this.midpoint)}px`, // Original position
            textAlign: 'center',
            lineHeight: '1.5',
            fontSize: '15px', // Original font size
            width: '100%',
            color: this.textColor
        });

        const arrowStyle = `font-size: 40px; vertical-align: middle;`; // Original size

        const leftArrow = `<span style="color: ${headMove === 'L' ? this.gifColor : this.textColor}; ${arrowStyle}">←</span>`;
        const rightArrow = `<span style="color: ${headMove === 'R' ? this.gifColor : this.textColor}; ${arrowStyle}">→</span>`;

        const stateDisplay = document.createElement('div');
        stateDisplay.style.fontSize = '15px'; // Original size
        stateDisplay.style.fontWeight = 'bold';
        stateDisplay.innerHTML = `${leftArrow} (STEP [${stepIndex}]: ${state}) ${rightArrow}`;

        statusContainer.appendChild(stateDisplay);
        return statusContainer;
    }

    createTapeSummary(tape) {
        const summary = document.createElement('div');
        Object.assign(summary.style, {
            position: 'absolute',
            top: '140px',
            left: '20px',
            fontSize: '12px',
            lineHeight: '1.7',
            color: this.textColor
        });

        const currentLabel = document.createElement('div');
        currentLabel.textContent = `   Full Tape: ${this._tapeToString(tape)}`;
        currentLabel.style.whiteSpace = 'pre';

        const initialLabel = document.createElement('div');
        initialLabel.textContent = `Initial Tape: ${this._initialTapeString}`;
        currentLabel.style.whiteSpace = 'pre';

        summary.appendChild(initialLabel);
        summary.appendChild(currentLabel);
        return summary;
    }

    _tapeToString(tape) {
        const keys = Object.keys(tape).map(Number);
        if (keys.length === 0) return '';

        const min = Math.min(...keys);
        const max = Math.max(...keys);
        let result = '';

        for (let i = min; i <= max; i++) {
            result += tape[i] ?? '_';
        }
        return result;
    }

    async _finalizeGIF() {
        return new Promise((resolve, reject) => {
            this.progressElement.textContent = `GIF Rendering... This may take a while`;
            this.gif.on('abort', () => reject(new Error("GIF generation aborted")));
            this.gif.on('error', e => reject(e));
            this.gif.render();
            this.gif.on('finished', blob => this.handleGIFComplete(blob, resolve));
        });
    }

    handleGIFComplete(blob, resolve) {
        const url = URL.createObjectURL(blob);
        this.progressElement.textContent = `GIF Rendered`;
        const gifview = document.getElementById('gifContainer')
        gifview.style.display = "block";

        // Set preview image
        const preview = document.getElementById('gifPreview');
        preview.src = url;

        // Set download link
        const downloadLink = document.getElementById('downloadGIF');
        downloadLink.href = url;
        downloadLink.download = `${this.gifName}.gif`;

        this.isBuilding = false;
        resolve(blob);
    }

    handleBuildError(error) {
        this.isBuilding = false;
        this.progressElement.textContent = 'Error generating GIF';
        console.error('GIF generation error:', error);
    }

    cancel() {
        document.getElementById('gifCard').style.display = 'none';
        if (confirm("Are you sure you want to cancel generation of GIF?")) {
            if (this.isBuilding && this.gif) {
                this.gif.abort();
                this.isBuilding = false;
                this.progressElement.textContent = 'GIF generation cancelled';
            }
        }
    }

    resetGIFCard() {

        // Hide the gif container and preview
        document.getElementById('gifContainer').style.display = 'none';

        // Clear preview image
        const gifPreview = document.getElementById('gifPreview');
        gifPreview.src = '';
        gifPreview.alt = 'GIF Preview';

        // Clear status
        document.getElementById('GIFStatus').textContent = '';

        // Hide the entire gif card (if needed)
        document.getElementById('gifCard').style.display = 'none';

        // Reset download link
        // const downloadLink = document.getElementById('downloadGIF');
        // downloadLink.href = '#';
        // downloadLink.download = 'turing-machine.gif';
    }

}

export { GIFBuilder };