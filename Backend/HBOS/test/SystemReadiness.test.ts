import { HBOSBootService } from "../Core/Boot/HBOSBootService";
import { BootStatus } from "../Core/Boot/BootStatus";


describe(
    "System Readiness",
    () => {


        test(
            "system should be READY when all engines are healthy",
            () => {


                const bootService =
                    new HBOSBootService();



                const report =
                    bootService.startBoot(

                        [

                            {
                                name: "Memory Engine",
                                status: "RUNNING",
                                healthy: true
                            },


                            {
                                name: "Decision Engine",
                                status: "RUNNING",
                                healthy: true
                            },


                            {
                                name: "Assistant Engine",
                                status: "RUNNING",
                                healthy: true
                            }

                        ],


                        true

                    );



                expect(
                    report.status
                )
                .toBe(
                    BootStatus.READY
                );



                expect(
                    report.dependencies.passed
                )
                .toBe(true);



            }
        );



    }
);