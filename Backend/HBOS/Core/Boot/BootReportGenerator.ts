import { BootReport } from "./BootReport";
import { BootStatus } from "./BootStatus";


export class BootReportGenerator {



    generate(
        engines: {
            name: string;
            status: string;
            healthy: boolean;
        }[],
        dependenciesPassed: boolean,
        bootDuration: number
    ): BootReport {



        const systemReady =
            engines.every(
                engine => engine.healthy
            )
            &&
            dependenciesPassed;



        return {


            status:
                systemReady
                    ? BootStatus.READY
                    : BootStatus.DEGRADED,



            timestamp:
                new Date(),



            bootDuration,



            engines,



            dependencies: {

                passed:
                    dependenciesPassed,


                details:
                    dependenciesPassed
                        ? "All dependencies satisfied"
                        : "Dependency validation failed"

            }


        };


    }



}