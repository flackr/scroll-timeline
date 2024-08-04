export declare interface Options {
    configuredUrls: string[];
}

export declare type InitializationOptions = Options|undefined;

export declare function initialize(initializationOptions?: InitializationOptions): Promise<void>;
