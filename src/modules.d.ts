declare module "memory-stream" {
    import { Stream, WritableOptions } from "stream";

    type MemoryStreamOptions = WritableOptions & {
        encoding?: 'Buffer' | 'utf8';
    };

    class MemorySteam extends Stream.Writable {
        private buffer;
        private options;
        constructor(options?: MemoryStreamOptions);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        _write(chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void): void;
        get(): Buffer;
        toString(): string;
        toBuffer(): Buffer;
    }

    export = MemorySteam
}
