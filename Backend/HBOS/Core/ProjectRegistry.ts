import { Project } from "./Project";


export class ProjectRegistry {

    private projects: Project[] = [];


    addProject(name: string): void {

        const project = new Project(name);

        this.projects.push(project);

    }


    listProjects(): Project[] {

        return this.projects;

    }

}