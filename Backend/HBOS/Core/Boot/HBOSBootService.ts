import { BootTimer } from "./BootTimer";
import { BootReportGenerator } from "./BootReportGenerator";
import { BootReport } from "./BootReport";


export class HBOSBootService {


    private timer: BootTimer;

    private reportGenerator:
        BootReportGenerator;



    constructor() {

        this.timer =
            new BootTimer();


        this.reportGenerator =
            new BootReportGenerator();

    }




    startBoot(
        engines: {
            name: string;
            status: string;
            healthy: boolean;
        }[],
        dependenciesPassed: boolean
    ): BootReport {



        this.timer.start();



        const duration =
            this.timer.stop();



        return this.reportGenerator.generate(

            engines,

            dependenciesPassed,

            duration

        );


    }



}