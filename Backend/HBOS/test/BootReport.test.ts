import { BootReportGenerator } from "../Core/Boot/BootReportGenerator";
import { BootStatus } from "../Core/Boot/BootStatus";


describe(
    "Boot Report Generator",
    () => {


        test(
            "should generate READY boot report",
            () => {


                const generator =
                    new BootReportGenerator();



                const report =
                    generator.generate(
                        [
                            {
                                name: "Memory Engine",
                                status: "RUNNING",
                                healthy: true
                            },

                            {
                                name: "Knowledge Engine",
                                status: "RUNNING",
                                healthy: true
                            },

                            {
                                name: "Assistant Engine",
                                status: "RUNNING",
                                healthy: true
                            }
                        ],

                        true,

                        120
                    );



                expect(report.status)
                    .toBe(BootStatus.READY);



                expect(
                    report.engines.length
                )
                    .toBe(3);



                expect(
                    report.dependencies.passed
                )
                    .toBe(true);



                expect(
                    report.bootDuration
                )
                    .toBe(120);



            }
        );



    }
);