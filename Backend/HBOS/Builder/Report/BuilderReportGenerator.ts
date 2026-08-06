export class BuilderReportGenerator {

    generate(analysis: any) {

        return {
            projectName: analysis.projectName,
            status: analysis.status,
            health: analysis.health,
            recommendations: analysis.recommendations ?? []
        };

    }

}
