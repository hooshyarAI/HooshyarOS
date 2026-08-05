import { BootStatus } from "./BootStatus";


export interface BootReport {


    status: BootStatus;


    timestamp: Date;


    bootDuration: number;


    engines: {


        name: string;


        status: string;


        healthy: boolean;


    }[];



    dependencies: {


        passed: boolean;


        details: string;


    };


}