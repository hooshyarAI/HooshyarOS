import { ProjectStatus } from "./ProjectStatus";

export class ProjectInsight {

    projectName: string;

    status: ProjectStatus;

    message: string;


    constructor(

        projectName: string,

        status: ProjectStatus,

        message: string

    ) {

        this.projectName = projectName;

        this.status = status;

        this.message = message;

    }

}