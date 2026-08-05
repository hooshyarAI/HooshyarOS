import { BootTimer } from "../Core/Boot/BootTimer";


describe(
    "Boot Timer",
    () => {


        test(
            "should calculate boot duration",
            () => {


                const timer =
                    new BootTimer();



                timer.start();



                const duration =
                    timer.stop();



                expect(
                    duration
                )
                .toBeGreaterThanOrEqual(0);



            }
        );



    }
);