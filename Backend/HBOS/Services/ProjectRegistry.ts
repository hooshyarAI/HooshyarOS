import { Project } from "../Entities/Project";


export class ProjectRegistry {


    name: string = "ProjectRegistry";


    private projects: Project[] = [];



    initialize(): void {

        console.log(
            "Project Registry Started"
        );

    }



    health(): boolean {

        return true;

    }



    register(
        project: Project
    ): void {

        this.projects.push(
            project
        );

    }



    getProjects(): Project[] {

        return this.projects;

    }



    findByName(
        name: string
    ): Project | undefined {


        return this.projects.find(

            project =>
                project.name === name

        );

    }



    count(): number {

        return this.projects.length;

    }



}