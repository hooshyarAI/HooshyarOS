import { Project } from "./Project";


export class AssistantResponse {


    project: Project;

    message: string;

    confidence: number;



    constructor(

        project: Project,

        message: string,

        confidence: number

    ) {

        this.project = project;

        this.message = message;

        this.confidence = confidence;

    }


}