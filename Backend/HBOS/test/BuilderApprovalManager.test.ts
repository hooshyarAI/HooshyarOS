import { BuilderApprovalManager } from "../Builder/Approval/BuilderApprovalManager";


test("BuilderApprovalManager should approve action",()=>{


    const manager = new BuilderApprovalManager();


    const result = manager.requestApproval({

        name:"BUILD_PROJECT"

    });


    expect(result.approved)
    .toBe(true);


    expect(result.approver)
    .toBe("HBOS");


});
