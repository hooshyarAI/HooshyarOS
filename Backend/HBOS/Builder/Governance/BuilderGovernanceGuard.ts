export class BuilderGovernanceGuard {

    validate(action:any){
        if(!action || !action.name){
            return false;
        }

        return true;
    }

}
