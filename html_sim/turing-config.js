class TuringConfig {
    static LEFT = "L";
    static RIGHT = "R";
    static BLANK = "_";
    static COMMENT_PREFIX = "//";

    static MAX_STATES = 1024;         // 2^10
    static MAX_TAPE_LEN = 1048576;   // 2^20 cells
    static MAX_STATE_SIZE = 32;     // 32 Chars
    static TRANSITION_SIZE = 710000; // 710,000 Chars

    static getTimestamp() {
        return performance.now() / 1000; // Convert to seconds
    }

    static getCurrentMemoryMB() {
        // Browser JavaScript doesn't have direct memory access
        // This is a placeholder that would work in Node.js
        return 0;
    }
}