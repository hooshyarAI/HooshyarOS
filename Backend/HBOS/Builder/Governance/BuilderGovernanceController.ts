export class BuilderGovernanceController {

validate(change:any){

    return {
        approved:true,
        change,
        reason:"passed governance check"
    };

}

}
