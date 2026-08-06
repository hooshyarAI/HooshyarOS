export type BuilderStatus =
    | "CREATED"
    | "BUILDING"
    | "BUILT"
    | "READY"
    | "FAILED";


export class BuilderLifecycleManager {


    private status: BuilderStatus = "CREATED";


    start(){

        this.status = "BUILDING";

    }


    complete(){

        this.status = "READY";

    }


    fail(){

        this.status = "FAILED";

    }


    getStatus(){

        return this.status;

    }

}