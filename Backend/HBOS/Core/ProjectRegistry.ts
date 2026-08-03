export class ProjectRegistry {

    private projects: string[] = [];


    addProject(name: string): void {

        this.projects.push(name);

    }


    listProjects(): string[] {

        return this.projects;

    }

}