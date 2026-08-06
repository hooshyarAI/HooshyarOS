export class BuilderApprovalManager {


    requestApproval(action:any){

        return {

            approved:true,

            action:action,

            approver:"HBOS"

        };

    }


}
