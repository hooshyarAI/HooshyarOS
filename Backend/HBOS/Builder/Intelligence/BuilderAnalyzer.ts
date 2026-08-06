export class BuilderAnalyzer {

    analyze(projectName: string) {

        return {
            project: projectName,
            status: "READY",
            architecture: "HBOS",
            engines: 0,
            risk: "LOW",
            recommendation: "CONTINUE"
        };

    }

}
