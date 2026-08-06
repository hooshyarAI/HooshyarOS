export class ProjectRegistry {

    private projects: Map<string, any> = new Map();

    register(project: any) {
        this.projects.set(project.name, project);
    }

    find(name: string) {
        return this.projects.get(name);
    }

    list() {
        return Array.from(this.projects.values());
    }
}
