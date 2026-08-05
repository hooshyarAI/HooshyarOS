export class BootTimer {


    private startTime: number = 0;



    start(): void {

        this.startTime =
            Date.now();

    }



    stop(): number {

        if (this.startTime === 0) {

            return 0;

        }


        return Date.now() - this.startTime;

    }



}