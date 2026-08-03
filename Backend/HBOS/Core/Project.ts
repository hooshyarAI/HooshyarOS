export class Project {

    id: string;

    name: string;

    status: string;

    createdAt: Date;


    constructor(name: string) {

        this.id = crypto.randomUUID();

        this.name = name;

        this.status = "Active";

        this.createdAt = new Date();

    }

}