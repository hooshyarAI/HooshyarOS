export class BuilderEngine {

    initialize() {

        console.log("BuilderEngine Started");

        return {
            name: "BuilderEngine",
            status: "READY"
        };

    }


    build(projectName: string) {

        console.log(
            `Building ${projectName}`
        );


        return {

            name: projectName,

            status: "READY"

        };

    }

}