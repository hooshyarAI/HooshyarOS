export class SelfReviewAgent {

review(output:any){

return {
    approved:true,
    checked:output,
    reviewer:"self-review-agent"
};

}

}

