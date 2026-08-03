import { AssistantContext } from "./AssistantContext";


export class AssistantConfidence {


    calculate(
        context: AssistantContext
    ): number {


        let score = 0.5;


        // داشتن اطلاعات پروژه
        if (context.project.name) {

            score += 0.2;

        }


        // وجود حافظه‌های ثبت‌شده
        if (context.memories.length > 0) {

            score += 0.2;

        }


        // وضعیت مشخص پروژه
        if (context.project.status) {

            score += 0.1;

        }


        if (score > 1) {

            score = 1;

        }


        return Number(
            score.toFixed(2)
        );

    }

}